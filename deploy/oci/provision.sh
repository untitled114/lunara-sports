#!/usr/bin/env bash
# One-time (idempotent) provisioning of Lunara on sport-suite-main, run from the laptop.
#
#   deploy/oci/provision.sh [--dry-run]
#
# Uses the SSH alias ss-admin (ubuntu, passwordless sudo); override with LUNARA_SSH_HOST.
# Creates the lunara user, /opt/lunara, /etc/lunara, a uv-managed Python 3.12, the
# lunara_app role and lunara database on sportsuite_db, applies the migrations, writes
# /etc/lunara/{api,ingestion,lumen}.env, generates the origin TLS key + CSR in
# /etc/lunara/tls (printing only the CSR path) and starts the lunara_redis container.
# Secrets are generated or read on the server and never printed. --dry-run prints every
# step and makes no ssh connection.

# shellcheck source=deploy/oci/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_args "$@"
((DRY_RUN)) && say "DRY RUN: nothing is executed and no ssh connection is made"

say "provision: user, directories, Python 3.12"
remote provision base

stage_bundle

say "lumen secrets: /etc/lunara/lumen.secret (staged by the owner) or an existing lumen.env"
check_cmd="sudo test -f /etc/lunara/lumen.secret || { sudo grep -qs '^DISCORD_TOKEN=.' \
/etc/lunara/lumen.env && sudo grep -qs '^ANTHROPIC_API_KEY=.' /etc/lunara/lumen.env; }"
printf "    + ssh %s \"%s\"\n" "$SSH_HOST" "$check_cmd"
if ((DRY_RUN)); then
    printf '    (if neither exists: prompt DISCORD_TOKEN and ANTHROPIC_API_KEY with hidden input\n'
    printf '     and send them on ssh stdin into /etc/lunara/lumen.secret, 0600 root:root)\n'
else
    # shellcheck disable=SC2029  # check_cmd is a fixed string meant to run remotely
    if ssh "$SSH_HOST" "$check_cmd"; then
        printf '    lumen secrets present on the server\n'
    else
        printf '    lumen secrets missing on the server; enter them (input hidden)\n'
        read -rsp '    DISCORD_TOKEN: ' discord_token && printf '\n'
        read -rsp '    ANTHROPIC_API_KEY: ' anthropic_key && printf '\n'
        [[ -n "$discord_token" && -n "$anthropic_key" ]] || {
            printf 'both values are required\n' >&2
            exit 1
        }
        printf 'DISCORD_TOKEN=%s\nANTHROPIC_API_KEY=%s\n' "$discord_token" "$anthropic_key" |
            ssh "$SSH_HOST" "sudo sh -c 'umask 077; cat > /etc/lunara/lumen.secret'"
        unset discord_token anthropic_key
        printf '    staged /etc/lunara/lumen.secret\n'
    fi
fi

say "provision: DB role + database, migrations, env files, TLS key + CSR, Redis"
remote provision finish

say "provision complete; next steps"
printf '    1. controller: fetch the CSR (public) printed above, issue a Cloudflare Origin CA cert\n'
printf '       for it, then: deploy/oci/install_origin_cert.sh <cert.pem>\n'
printf '    2. deploy/oci/deploy.sh\n'
