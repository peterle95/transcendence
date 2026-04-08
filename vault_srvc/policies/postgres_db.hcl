path  "secret/data/postgres/env"  {
  capabilities = ["read"]
}

path  "secret/data/postgres/init"  {
  capabilities = ["create"]
}
