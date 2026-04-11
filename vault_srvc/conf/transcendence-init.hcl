ui            = true
api_addr      = "https://127.0.0.1:8200"

disable_mlock = false
disable_cache = false

log_level     = "trace"
log_format    = "json"
log_file      = "/vault/logs/vault-init.log"

storage   "file"  {
  path    = "/vault/file/"
}

listener  "tcp"   {
  address = "127.0.0.1:8200"

  tls_cert_file       = "/vault/secret/ca_root/transcendence-secret-vault.crt"
  tls_key_file        = "/vault/secret/ca_root/transcendence-secret-vault.key"
}
