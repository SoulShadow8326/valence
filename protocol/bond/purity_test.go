package bond

import (
	"os/exec"
	"strings"
	"testing"
)













func TestBondPurity(t *testing.T) {
	out, err := exec.Command("go", "list", "-f", "{{join .Imports \"\\n\"}}", ".").Output()
	if err != nil {
		t.Fatal(err)
	}
	for _, dep := range strings.Fields(string(out)) {
		if dep == "time" || strings.Contains(dep, "valence/node") {
			t.Fatalf("protocol/bond imports %q — bond formation must be a pure "+
				"function of atom content (RFC-0001 §4.5, SECURITY.md §3.1). "+
				"If you're about to weight a bond by trust or decay it by age: "+
				"that breaks the project's central claim that two nodes with "+
				"the same atom set derive the same graph. Put it in node/policy instead.",
				dep)
		}
	}
}
