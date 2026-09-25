#!/usr/bin/env bash
# Install the Cloudflare Origin CA certificate for api.lunara-app.com on sport-suite-main.
#
#   deploy/oci/install_origin_cert.sh [--dry-run] <cert.pem>
#
# The private key never leaves the box: provision.sh generated it next to the CSR in
# /etc/lunara/tls/. This script checks the local PEM (parses, names api.lunara-app.com,
# not expired), checks its public key against the key on the box (only public-key hashes
# are compared), then writes it to /etc/lunara/tls/api.lunara-app.com.pem (0644
# root:root) through ssh stdin. If the api nginx site is already enabled, it runs nginx -t
# and reloads nginx. --dry-run prints the steps and makes no ssh connection.

# shellcheck source=deploy/oci/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

readonly HOSTNAME_API=api.lunara-app.com
readonly REMOTE_DIR=/etc/lunara/tls
readonly REMOTE_CERT=$REMOTE_DIR/$HOSTNAME_API.pem
readonly REMOTE_KEY=$REMOTE_DIR/$HOSTNAME_API.key

cert=""
args=()
for a in "$@"; do
    case "$a" in
        --dry-run | -h | --help) args+=("$a") ;;
        *) cert="$a" ;;
    esac
done
parse_common_args "${args[@]+"${args[@]}"}"
[[ -n "$cert" ]] || {
    printf 'usage: %s [--dry-run] <cert.pem>\n' "$0" >&2
    exit 2
}
((DRY_RUN)) && say "DRY RUN: nothing is executed and no ssh connection is made"

say "1. check the local certificate $cert"
printf '    + openssl x509 -in %s -noout (parse, -checkend 0, SAN/CN has %s)\n' "$cert" \
    "$HOSTNAME_API"
if ! ((DRY_RUN)); then
    openssl x509 -in "$cert" -noout -checkend 0 >/dev/null || {
        printf '%s is not a valid, unexpired PEM certificate\n' "$cert" >&2
        exit 1
    }
    openssl x509 -in "$cert" -noout -subject -ext subjectAltName 2>/dev/null |
        grep -q "$HOSTNAME_API" || {
        printf '%s does not name %s\n' "$cert" "$HOSTNAME_API" >&2
        exit 1
    }
    printf '    ok: %s\n' "$(openssl x509 -in "$cert" -noout -enddate)"
fi

say "2. compare public keys: local cert vs $REMOTE_KEY on the box"
printf "    + ssh %s 'sudo openssl pkey -in %s -pubout | sha256sum'\n" "$SSH_HOST" "$REMOTE_KEY"
if ! ((DRY_RUN)); then
    local_pub="$(openssl x509 -in "$cert" -noout -pubkey | sha256sum)"
    # shellcheck disable=SC2029  # the key path is a fixed constant expanded locally
    remote_pub="$(ssh "$SSH_HOST" "sudo openssl pkey -in $REMOTE_KEY -pubout | sha256sum")"
    [[ "$local_pub" == "$remote_pub" ]] || {
        printf 'certificate does not match %s (was it issued from the box CSR?)\n' \
            "$REMOTE_KEY" >&2
        exit 1
    }
    printf '    ok: public keys match\n'
fi

say "3. install $REMOTE_CERT (0644 root:root) and reload nginx if the api site is enabled"
install_cmd="sudo sh -c 'umask 022; cat > $REMOTE_CERT.tmp && chown root:root $REMOTE_CERT.tmp \
&& chmod 0644 $REMOTE_CERT.tmp && mv -f $REMOTE_CERT.tmp $REMOTE_CERT' && \
if [ -e /etc/nginx/sites-enabled/$HOSTNAME_API ]; then sudo nginx -t && \
sudo systemctl reload nginx && echo '    nginx reloaded'; else echo '    api site not enabled \
yet; deploy.sh will install it'; fi"
printf "    + ssh %s \"%s\" < %s\n" "$SSH_HOST" "$install_cmd" "$cert"
if ! ((DRY_RUN)); then
    # shellcheck disable=SC2029  # install_cmd is built from fixed constants
    ssh "$SSH_HOST" "$install_cmd" <"$cert"
fi

say "done; next: deploy/oci/deploy.sh (or nothing, if this was a renewal)"
