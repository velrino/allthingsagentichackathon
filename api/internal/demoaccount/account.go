package demoaccount

// These credentials are intentionally public for the hackathon jury. Real
// deployments should override them or disable the demo bootstrap entirely.
const (
	DefaultEmail       = "velrino@gmail.com"
	DefaultPassword    = "2vl5Jsh1QIiemKPmIapzcKissFuu"
	DefaultDisplayName = "Emily"
)

type Credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
