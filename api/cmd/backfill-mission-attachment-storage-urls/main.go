package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"mime"
	"net/url"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	gcs "cloud.google.com/go/storage"
	"github.com/joho/godotenv"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

const (
	missionsCollection          = "missions"
	publishedRevisions          = "published_revisions"
	teacherClassesCollection    = "teacher_classes"
	storedStatus                = "stored"
	uploadcareCDNHostSuffix     = ".ucarecd.net"
	uploadcareOriginalURLField  = "uploadcare_cdn_url"
	storagePublicURLDescription = "https://storage.googleapis.com/{bucket}/{object_path}"
)

type counters struct {
	docsScanned        int
	docsChanged        int
	attachmentsChanged int
}

type storedObjectRef struct {
	bucket     string
	objectPath string
	publicURL  string
}

type runState struct {
	sampleLimit int
	samples     []string
	objects     map[string]storedObjectRef
}

func main() {
	apply := flag.Bool("apply", false, "write updates to Firestore")
	makePublic := flag.Bool("make-public", false, "grant allUsers read access and inline disposition to stored attachment objects")
	sampleLimit := flag.Int("sample-limit", 5, "number of public storage URLs to print")
	flag.Parse()

	_ = godotenv.Load(".env")

	projectID := strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID"))
	if projectID == "" {
		log.Fatal("FIREBASE_PROJECT_ID is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	options := []option.ClientOption{}
	if credentialsFile := strings.TrimSpace(os.Getenv("FIREBASE_CREDENTIALS_FILE")); credentialsFile != "" {
		options = append(options, option.WithCredentialsFile(credentialsFile))
	}

	client, err := firestore.NewClient(ctx, projectID, options...)
	if err != nil {
		log.Fatalf("connect firestore: %v", err)
	}
	defer client.Close()

	var storageClient *gcs.Client
	if *makePublic {
		storageClient, err = gcs.NewClient(ctx, options...)
		if err != nil {
			log.Fatalf("connect cloud storage: %v", err)
		}
		defer storageClient.Close()
	}

	mode := "dry-run"
	if *apply {
		mode = "apply"
	}
	fmt.Printf("Backfilling mission attachment cdn_url values to %s in %s mode\n", storagePublicURLDescription, mode)

	var total counters
	state := runState{
		sampleLimit: *sampleLimit,
		objects:     make(map[string]storedObjectRef),
	}
	if err := scanMissionCollection(ctx, client.Collection(missionsCollection), *apply, &total, &state); err != nil {
		log.Fatalf("scan top-level missions: %v", err)
	}
	if err := scanLegacyMissionCollections(ctx, client, *apply, &total, &state); err != nil {
		log.Fatalf("scan legacy class missions: %v", err)
	}

	fmt.Printf("Scanned %d docs, changed %d docs, updated %d attachment URLs\n",
		total.docsScanned,
		total.docsChanged,
		total.attachmentsChanged,
	)
	fmt.Printf("Found %d stored object(s)\n", len(state.objects))
	for _, sample := range state.samples {
		fmt.Printf("sample: %s\n", sample)
	}

	if *makePublic {
		if !*apply {
			fmt.Printf("Dry-run: would grant public read to %d stored object(s)\n", len(state.objects))
			return
		}
		if err := makeStoredObjectsPublicAndInline(ctx, storageClient, state.objects); err != nil {
			log.Fatalf("make stored objects public: %v", err)
		}
	}
}

func scanLegacyMissionCollections(
	ctx context.Context,
	client *firestore.Client,
	apply bool,
	total *counters,
	state *runState,
) error {
	iter := client.Collection(teacherClassesCollection).Documents(ctx)
	defer iter.Stop()

	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return fmt.Errorf("iterate teacher classes: %w", err)
		}
		if err := scanMissionCollection(ctx, snapshot.Ref.Collection(missionsCollection), apply, total, state); err != nil {
			return err
		}
	}

	return nil
}

func scanMissionCollection(
	ctx context.Context,
	collection *firestore.CollectionRef,
	apply bool,
	total *counters,
	state *runState,
) error {
	iter := collection.Documents(ctx)
	defer iter.Stop()

	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return fmt.Errorf("iterate %s: %w", collection.Path, err)
		}
		if err := updateMissionDoc(ctx, snapshot, apply, total, state); err != nil {
			return err
		}
		if err := scanPublishedRevisions(ctx, snapshot.Ref, apply, total, state); err != nil {
			return err
		}
	}

	return nil
}

func scanPublishedRevisions(
	ctx context.Context,
	missionRef *firestore.DocumentRef,
	apply bool,
	total *counters,
	state *runState,
) error {
	iter := missionRef.Collection(publishedRevisions).Documents(ctx)
	defer iter.Stop()

	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return fmt.Errorf("iterate revisions for %s: %w", missionRef.Path, err)
		}
		if err := updateRevisionDoc(ctx, snapshot, apply, total, state); err != nil {
			return err
		}
	}

	return nil
}

func updateMissionDoc(
	ctx context.Context,
	snapshot *firestore.DocumentSnapshot,
	apply bool,
	total *counters,
	state *runState,
) error {
	total.docsScanned++
	data := snapshot.Data()

	updates := make([]firestore.Update, 0, 3)
	changed := 0
	if rewritten, count, ok := rewriteAttachments(data["attachments"], state); ok && count > 0 {
		updates = append(updates, firestore.Update{Path: "attachments", Value: rewritten})
		changed += count
	}
	if draft, ok := data["draft"].(map[string]any); ok {
		if rewritten, count, ok := rewriteAttachments(draft["attachments"], state); ok && count > 0 {
			updates = append(updates, firestore.Update{Path: "draft.attachments", Value: rewritten})
			changed += count
		}
	}
	if published, ok := data["published"].(map[string]any); ok {
		if rewritten, count, ok := rewriteAttachments(published["attachments"], state); ok && count > 0 {
			updates = append(updates, firestore.Update{Path: "published.attachments", Value: rewritten})
			changed += count
		}
	}

	return writeUpdates(ctx, snapshot.Ref, updates, changed, apply, total)
}

func updateRevisionDoc(
	ctx context.Context,
	snapshot *firestore.DocumentSnapshot,
	apply bool,
	total *counters,
	state *runState,
) error {
	total.docsScanned++
	data := snapshot.Data()

	updates := make([]firestore.Update, 0, 1)
	changed := 0
	if revisionSnapshot, ok := data["snapshot"].(map[string]any); ok {
		if rewritten, count, ok := rewriteAttachments(revisionSnapshot["attachments"], state); ok && count > 0 {
			updates = append(updates, firestore.Update{Path: "snapshot.attachments", Value: rewritten})
			changed += count
		}
	}

	return writeUpdates(ctx, snapshot.Ref, updates, changed, apply, total)
}

func writeUpdates(
	ctx context.Context,
	ref *firestore.DocumentRef,
	updates []firestore.Update,
	changed int,
	apply bool,
	total *counters,
) error {
	if changed == 0 {
		return nil
	}

	total.docsChanged++
	total.attachmentsChanged += changed
	fmt.Printf("%s: %d attachment URL(s)\n", ref.Path, changed)
	if !apply {
		return nil
	}

	if _, err := ref.Update(ctx, updates); err != nil {
		return fmt.Errorf("update %s: %w", ref.Path, err)
	}

	return nil
}

func rewriteAttachments(value any, state *runState) ([]any, int, bool) {
	values, ok := value.([]any)
	if !ok {
		return nil, 0, false
	}

	rewritten := make([]any, len(values))
	changed := 0
	for index, value := range values {
		attachment, ok := value.(map[string]any)
		if !ok {
			rewritten[index] = value
			continue
		}

		copy := cloneMap(attachment)
		storage, _ := copy["storage"].(map[string]any)
		object := storageObject(storage)
		publicURL := object.publicURL
		if publicURL != "" {
			state.recordStoredObject(object)
		}
		if publicURL != "" && asString(copy["cdn_url"]) != publicURL {
			if originalURL := asString(copy["cdn_url"]); isUploadcareURL(originalURL) && asString(copy[uploadcareOriginalURLField]) == "" {
				copy[uploadcareOriginalURLField] = originalURL
			}
			copy["cdn_url"] = publicURL
			changed++
		}

		rewritten[index] = copy
	}

	return rewritten, changed, true
}

func storageObject(storage map[string]any) storedObjectRef {
	if asString(storage["status"]) != storedStatus {
		return storedObjectRef{}
	}

	bucket := strings.TrimSpace(asString(storage["bucket"]))
	objectPath := strings.Trim(strings.TrimSpace(asString(storage["object_path"])), "/")
	if (bucket == "" || objectPath == "") && strings.HasPrefix(strings.TrimSpace(asString(storage["gs_uri"])), "gs://") {
		bucket, objectPath = parseGSURI(asString(storage["gs_uri"]))
	}
	if bucket == "" || objectPath == "" {
		return storedObjectRef{}
	}

	return storedObjectRef{
		bucket:     bucket,
		objectPath: objectPath,
		publicURL:  "https://storage.googleapis.com/" + url.PathEscape(bucket) + "/" + escapeObjectPath(objectPath),
	}
}

func (state *runState) recordStoredObject(object storedObjectRef) {
	if state == nil || object.bucket == "" || object.objectPath == "" || object.publicURL == "" {
		return
	}

	key := object.bucket + "/" + object.objectPath
	if _, exists := state.objects[key]; !exists {
		state.objects[key] = object
		if len(state.samples) < state.sampleLimit {
			state.samples = append(state.samples, object.publicURL)
		}
	}
}

func makeStoredObjectsPublicAndInline(
	ctx context.Context,
	client *gcs.Client,
	objects map[string]storedObjectRef,
) error {
	keys := make([]string, 0, len(objects))
	for key := range objects {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	updated := 0
	for _, key := range keys {
		object := objects[key]
		handle := client.Bucket(object.bucket).Object(object.objectPath)
		if err := handle.ACL().Set(ctx, gcs.AllUsers, gcs.RoleReader); err != nil {
			return fmt.Errorf("set public ACL for gs://%s/%s: %w", object.bucket, object.objectPath, err)
		}
		if _, err := handle.Update(ctx, gcs.ObjectAttrsToUpdate{
			ContentDisposition: mime.FormatMediaType("inline", map[string]string{
				"filename": path.Base(object.objectPath),
			}),
		}); err != nil {
			return fmt.Errorf("set inline disposition for gs://%s/%s: %w", object.bucket, object.objectPath, err)
		}
		updated++
	}

	fmt.Printf("Granted public read and inline disposition to %d stored object(s)\n", updated)
	return nil
}

func parseGSURI(value string) (string, string) {
	path := strings.TrimPrefix(strings.TrimSpace(value), "gs://")
	bucket, objectPath, _ := strings.Cut(path, "/")

	return strings.TrimSpace(bucket), strings.Trim(strings.TrimSpace(objectPath), "/")
}

func escapeObjectPath(objectPath string) string {
	segments := strings.Split(objectPath, "/")
	for index, segment := range segments {
		segments[index] = url.PathEscape(segment)
	}

	return strings.Join(segments, "/")
}

func cloneMap(input map[string]any) map[string]any {
	output := make(map[string]any, len(input))
	for key, value := range input {
		output[key] = value
	}

	return output
}

func asString(value any) string {
	text, _ := value.(string)

	return strings.TrimSpace(text)
}

func isUploadcareURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return false
	}

	return parsed.Scheme == "https" && strings.HasSuffix(parsed.Hostname(), uploadcareCDNHostSuffix)
}
