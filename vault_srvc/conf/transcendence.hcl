ui            = true
api_addr      = "https://127.0.0.1:443"

disable_mlock = false
disable_cache = false

log_level     = "info"
log_format    = "standard"
log_file      = "/vault/logs/vault-default.log"

storage   "file"  {
  path    = "/vault/file/"
}

listener  "tcp"   {
  address = "0.0.0.0:443"

  tls_cert_file       = "/vault/secret/cacert/transcendence-secret-vault.crt"
  tls_key_file        = "/vault/secret/cacert/transcendence-secret-vault.key"
}
