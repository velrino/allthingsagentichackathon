import type { IApiTeacherClassMission } from "@/backend/api/api.interface";

const zeroTimestampPrefix = "0001-";

export function missionHasPublishedRevision(
  mission: IApiTeacherClassMission,
) {
  return (
    (mission.published_revision ?? 0) > 0 ||
    Boolean(
      mission.published_at &&
        !mission.published_at.startsWith(zeroTimestampPrefix),
    )
  );
}

export function missionHasUnpublishedChanges(
  mission: IApiTeacherClassMission,
) {
  if (mission.has_unpublished_changes !== undefined) {
    return mission.has_unpublished_changes;
  }

  return (
    (mission.published_revision ?? 0) > 0 &&
    (mission.draft_revision ?? 0) > (mission.published_revision ?? 0)
  );
}

export function missionIsStandaloneDraft(mission: IApiTeacherClassMission) {
  return (
    (mission.status === "draft" || mission.status === "preview") &&
    !missionHasPublishedRevision(mission)
  );
}
