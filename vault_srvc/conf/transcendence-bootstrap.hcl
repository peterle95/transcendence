ui            = false
api_addr      = "http://127.0.0.1:8200"

disable_mlock = false
disable_cache = false

log_level     = "trace"
log_format    = "json"
log_file      = "/vault/logs/vault-bootstrap.log"

storage   "file"  {
  path        = "/vault/file/"
}

listener  "tcp"   {
  address     = "127.0.0.1:8200"
  tls_disable = true
}
