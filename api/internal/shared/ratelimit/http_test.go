package ratelimit

import (
	"net/http"
	"testing"
	"time"
)

func TestSetResponseHeadersIncludesRoundedRetryAfter(t *testing.T) {
	header := make(http.Header)
	SetResponseHeaders(header, Decision{
		Allowed:    false,
		Limit:      12,
		Remaining:  0,
		RetryAfter: 1500 * time.Millisecond,
	})

	if got := header.Get("X-RateLimit-Limit"); got != "12" {
		t.Fatalf("X-RateLimit-Limit = %q, want %q", got, "12")
	}
	if got := header.Get("X-RateLimit-Remaining"); got != "0" {
		t.Fatalf("X-RateLimit-Remaining = %q, want %q", got, "0")
	}
	if got := header.Get("Retry-After"); got != "2" {
		t.Fatalf("Retry-After = %q, want %q", got, "2")
	}
}

func TestSetResponseHeadersOmitsRetryAfterWhenAllowed(t *testing.T) {
	header := make(http.Header)
	SetResponseHeaders(header, Decision{
		Allowed:    true,
		Limit:      12,
		Remaining:  11,
		RetryAfter: time.Minute,
	})

	if got := header.Get("Retry-After"); got != "" {
		t.Fatalf("Retry-After = %q, want empty", got)
	}
}
