package payments

import (
	"strings"
	"testing"
)

func TestDefaultMidtransMethodsHaveLocalLogoFallbacks(t *testing.T) {
	methods := defaultMidtransMethods()
	if len(methods) == 0 {
		t.Fatal("defaultMidtransMethods() returned no methods")
	}

	for _, method := range methods {
		if method.ImageURL == "" {
			t.Fatalf("%s has no default logo URL", method.ProviderMethod)
		}
		if !strings.HasPrefix(method.ImageURL, "/payment-logos/") {
			t.Fatalf(
				"%s logo URL %q is not a local payment logo path",
				method.ProviderMethod,
				method.ImageURL,
			)
		}
	}
}
