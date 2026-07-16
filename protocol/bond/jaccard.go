package bond

type Threshold struct {
	Num, Den int
}

var (
	ThresholdCorroborates = Threshold{1, 2}
	ThresholdSatisfies    = Threshold{1, 3}
	ThresholdContradicts  = Threshold{1, 2}
)

func jaccardMeets(a, b []string, th Threshold) bool {
	inter, union := overlapCounts(a, b)
	if union == 0 {
		return false
	}
	return inter*th.Den >= th.Num*union
}

func jaccardFloat(a, b []string) float64 {
	inter, union := overlapCounts(a, b)
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

func overlapCounts(a, b []string) (inter, union int) {
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			inter++
			union++
			i++
			j++
		case a[i] < b[j]:
			union++
			i++
		default:
			union++
			j++
		}
	}
	union += (len(a) - i) + (len(b) - j)
	return
}
