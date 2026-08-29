package tenant

import (
	"os"
	"strings"
)

const (
	defaultOrganizationID = "default-org"
	defaultDistrictID     = "default-district"
	defaultSchoolID       = "default-school"
)

type Scope struct {
	OrganizationID string `firestore:"organization_id" json:"organization_id"`
	DistrictID     string `firestore:"district_id" json:"district_id"`
	SchoolID       string `firestore:"school_id" json:"school_id"`
}

func DefaultScope() Scope {
	return Scope{
		OrganizationID: envString("DEFAULT_ORGANIZATION_ID", defaultOrganizationID),
		DistrictID:     envString("DEFAULT_DISTRICT_ID", defaultDistrictID),
		SchoolID:       envString("DEFAULT_SCHOOL_ID", defaultSchoolID),
	}
}

func NormalizeScope(scope Scope) Scope {
	defaultScope := DefaultScope()
	scope.OrganizationID = firstNonEmpty(scope.OrganizationID, defaultScope.OrganizationID)
	scope.DistrictID = firstNonEmpty(scope.DistrictID, defaultScope.DistrictID)
	scope.SchoolID = firstNonEmpty(scope.SchoolID, defaultScope.SchoolID)

	return scope
}

func envString(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}

	return ""
}
