package mission

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"classgame-api/internal/modules/missionattachment"
	teacherclass "classgame-api/internal/modules/teacher-class"
)

func (repository *Repository) Prepare(
	ctx context.Context,
	job missionattachment.Job,
) (missionattachment.TransferPlan, error) {
	if repository == nil || repository.client == nil {
		return missionattachment.TransferPlan{}, errors.New("mission attachment repository is not configured")
	}

	missionRef := repository.missionRef(job.ClassID, job.MissionID)
	revisionRef := missionRef.Collection(MissionRevisionsCollectionName).
		Doc(strconv.FormatInt(job.Revision, 10))
	plan := missionattachment.TransferPlan{}

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		revisionSnapshot, err := tx.Get(revisionRef)
		if status.Code(err) == codes.NotFound {
			return repository.classifyMissingRevision(ctx, tx, missionRef, job.Revision)
		}
		if err != nil {
			return fmt.Errorf("read mission attachment revision: %w", err)
		}

		var revision MissionPublishedRevisionDocument
		if err := revisionSnapshot.DataTo(&revision); err != nil {
			return fmt.Errorf("decode mission attachment revision: %w", err)
		}
		if revision.Revision != job.Revision || revision.ClassID != job.ClassID || revision.MissionID != job.MissionID {
			return missionattachment.ErrRevisionObsolete
		}

		mission, hasMission, err := readMissionForTransfer(ctx, tx, missionRef)
		if err != nil {
			return err
		}

		now := time.Now()
		changed := false
		plan.Attachments = make([]missionattachment.AttachmentSnapshot, 0, len(revision.Snapshot.Attachments))
		for index := range revision.Snapshot.Attachments {
			attachment := &revision.Snapshot.Attachments[index]
			if attachmentIsStored(*attachment) || attachmentFailedPermanently(*attachment) {
				continue
			}

			storage := copyAttachmentStorage(attachment.Storage)
			storage.Status = AttachmentStorageCopying
			storage.Attempts++
			storage.Retryable = true
			storage.Error = ""
			storage.UpdatedAt = now
			attachment.Storage = storage
			plan.Attachments = append(plan.Attachments, toTransferAttachment(*attachment))
			changed = true
		}

		if !changed {
			return nil
		}

		revision.AttachmentTransferStatus = AttachmentStorageCopying
		revision.AttachmentTransferAt = now
		if err := tx.Set(revisionRef, revision); err != nil {
			return fmt.Errorf("mark mission attachment revision copying: %w", err)
		}
		if hasMission {
			mirrorRevisionAttachments(&mission, job.Revision, revision.Snapshot.Attachments)
			if err := tx.Set(missionRef, mission.firestoreMap()); err != nil {
				return fmt.Errorf("mirror mission attachments copying: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return missionattachment.TransferPlan{}, err
	}

	return plan, nil
}

func (repository *Repository) MarkStored(
	ctx context.Context,
	job missionattachment.Job,
	target missionattachment.AttachmentSnapshot,
	stored missionattachment.StoredObject,
) error {
	return repository.updateRevisionAttachment(ctx, job, target, func(attachment *MissionAttachment) {
		now := time.Now()
		storage := copyAttachmentStorage(attachment.Storage)
		storage.Status = AttachmentStorageStored
		storage.Bucket = stored.Bucket
		storage.ObjectPath = stored.ObjectPath
		storage.GSURI = stored.GSURI
		storage.MimeType = stored.MIMEType
		storage.SizeBytes = stored.SizeBytes
		storage.Retryable = false
		storage.Error = ""
		storage.UpdatedAt = now
		storage.StoredAt = now
		attachment.Storage = storage
	})
}

func (repository *Repository) MarkFailed(
	ctx context.Context,
	job missionattachment.Job,
	target missionattachment.AttachmentSnapshot,
	message string,
	retryable bool,
) error {
	return repository.updateRevisionAttachment(ctx, job, target, func(attachment *MissionAttachment) {
		storage := copyAttachmentStorage(attachment.Storage)
		storage.Status = AttachmentStorageFailed
		storage.Retryable = retryable
		storage.Error = message
		storage.UpdatedAt = time.Now()
		attachment.Storage = storage
	})
}

func (repository *Repository) Complete(ctx context.Context, job missionattachment.Job) error {
	if repository == nil || repository.client == nil {
		return errors.New("mission attachment repository is not configured")
	}

	missionRef := repository.missionRef(job.ClassID, job.MissionID)
	revisionRef := missionRef.Collection(MissionRevisionsCollectionName).
		Doc(strconv.FormatInt(job.Revision, 10))

	return repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		revisionSnapshot, err := tx.Get(revisionRef)
		if status.Code(err) == codes.NotFound {
			return missionattachment.ErrRevisionObsolete
		}
		if err != nil {
			return fmt.Errorf("read completed mission attachment revision: %w", err)
		}

		var revision MissionPublishedRevisionDocument
		if err := revisionSnapshot.DataTo(&revision); err != nil {
			return fmt.Errorf("decode completed mission attachment revision: %w", err)
		}
		transferStatus := "complete"
		for _, attachment := range revision.Snapshot.Attachments {
			if attachment.Storage != nil && attachment.Storage.Status == AttachmentStorageFailed {
				transferStatus = "complete_with_failures"
			}
			if !attachmentIsStored(attachment) && !attachmentFailedPermanently(attachment) {
				return errors.New("mission attachment revision still has pending transfers")
			}
		}

		revision.AttachmentTransferStatus = transferStatus
		revision.AttachmentTransferAt = time.Now()
		if err := tx.Set(revisionRef, revision); err != nil {
			return fmt.Errorf("complete mission attachment revision: %w", err)
		}

		return nil
	})
}

func (repository *Repository) updateRevisionAttachment(
	ctx context.Context,
	job missionattachment.Job,
	target missionattachment.AttachmentSnapshot,
	update func(*MissionAttachment),
) error {
	if repository == nil || repository.client == nil {
		return errors.New("mission attachment repository is not configured")
	}

	missionRef := repository.missionRef(job.ClassID, job.MissionID)
	revisionRef := missionRef.Collection(MissionRevisionsCollectionName).
		Doc(strconv.FormatInt(job.Revision, 10))

	return repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		revisionSnapshot, err := tx.Get(revisionRef)
		if status.Code(err) == codes.NotFound {
			return missionattachment.ErrRevisionObsolete
		}
		if err != nil {
			return fmt.Errorf("read mission attachment update revision: %w", err)
		}

		var revision MissionPublishedRevisionDocument
		if err := revisionSnapshot.DataTo(&revision); err != nil {
			return fmt.Errorf("decode mission attachment update revision: %w", err)
		}

		attachmentIndex := findTransferAttachment(revision.Snapshot.Attachments, target)
		if attachmentIndex < 0 {
			return missionattachment.ErrRevisionObsolete
		}

		mission, hasMission, err := readMissionForTransfer(ctx, tx, missionRef)
		if err != nil {
			return err
		}

		update(&revision.Snapshot.Attachments[attachmentIndex])
		revision.AttachmentTransferAt = time.Now()
		if err := tx.Set(revisionRef, revision); err != nil {
			return fmt.Errorf("update mission attachment revision: %w", err)
		}
		if hasMission {
			mirrorRevisionAttachments(&mission, job.Revision, revision.Snapshot.Attachments)
			if err := tx.Set(missionRef, mission.firestoreMap()); err != nil {
				return fmt.Errorf("mirror mission attachment update: %w", err)
			}
		}

		return nil
	})
}

func (repository *Repository) classifyMissingRevision(
	ctx context.Context,
	tx *firestore.Transaction,
	missionRef *firestore.DocumentRef,
	revision int64,
) error {
	mission, exists, err := readMissionForTransfer(ctx, tx, missionRef)
	if err != nil {
		return err
	}
	if !exists || mission.Status == StatusDeleted || mission.PublishedRevision >= revision || mission.DraftRevision > revision {
		return missionattachment.ErrRevisionObsolete
	}

	return missionattachment.ErrRevisionPending
}

func readMissionForTransfer(
	ctx context.Context,
	tx *firestore.Transaction,
	missionRef *firestore.DocumentRef,
) (MissionDocument, bool, error) {
	snapshot, err := tx.Get(missionRef)
	if status.Code(err) == codes.NotFound {
		return MissionDocument{}, false, nil
	}
	if err != nil {
		return MissionDocument{}, false, fmt.Errorf("read mission for attachment transfer: %w", err)
	}

	var mission MissionDocument
	if err := snapshot.DataTo(&mission); err != nil {
		return MissionDocument{}, false, fmt.Errorf("decode mission for attachment transfer: %w", err)
	}
	if mission.ID == "" {
		mission.ID = snapshot.Ref.ID
	}
	hydrateMissionLifecycle(&mission)

	return mission, true, nil
}

func (repository *Repository) missionRef(classID string, missionID string) *firestore.DocumentRef {
	return repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(MissionsCollectionName).
		Doc(missionID)
}

func mirrorRevisionAttachments(
	mission *MissionDocument,
	revision int64,
	attachments []MissionAttachment,
) {
	if mission.Published != nil && mission.PublishedRevision == revision {
		mission.Published.Attachments = attachments
	}
	if mission.Draft != nil && mission.DraftRevision == revision {
		mission.Draft.Attachments = attachments
		mission.Attachments = attachments
	}
}

func toTransferAttachment(attachment MissionAttachment) missionattachment.AttachmentSnapshot {
	return missionattachment.AttachmentSnapshot{
		UploadcareUUID: attachment.UploadcareUUID,
		SourceURL:      attachment.CDNURL,
		FileName:       attachment.FileName,
		MIMEType:       attachment.MimeType,
		SizeBytes:      attachment.SizeBytes,
	}
}

func findTransferAttachment(
	attachments []MissionAttachment,
	target missionattachment.AttachmentSnapshot,
) int {
	for index, attachment := range attachments {
		if target.UploadcareUUID != "" && attachment.UploadcareUUID == target.UploadcareUUID {
			return index
		}
		if target.UploadcareUUID == "" && attachment.CDNURL == target.SourceURL && attachment.FileName == target.FileName {
			return index
		}
	}

	return -1
}

func copyAttachmentStorage(storage *MissionAttachmentStorage) *MissionAttachmentStorage {
	if storage == nil {
		return &MissionAttachmentStorage{}
	}

	copy := *storage
	return &copy
}

func attachmentIsStored(attachment MissionAttachment) bool {
	return attachment.Storage != nil &&
		attachment.Storage.Status == AttachmentStorageStored &&
		attachment.Storage.GSURI != ""
}

func attachmentFailedPermanently(attachment MissionAttachment) bool {
	return attachment.Storage != nil &&
		attachment.Storage.Status == AttachmentStorageFailed &&
		!attachment.Storage.Retryable
}
