length=100

rule "charset" {
  charset = "0123456789"
  min-chars = 8
}

rule "charset" {
  charset = "abcdefghijklmnopqrstuvwxyz"
  min-chars = 8
}

rule "charset" {
  charset = "ABCDEFGHJIKLMNOPQRSTUVWXYZ"
  min-chars = 8
}
