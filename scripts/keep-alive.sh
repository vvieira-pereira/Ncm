#!/usr/bin/env bash
# Rotina diaria: 15 buscas reais ao banco (Supabase) pela API REST, para manter o projeto ativo.
# Le apenas tabelas publicas da NCM. Nao grava nada e nao usa chave secreta.
# Variaveis: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (a chave publicavel, nunca a secreta).
set -u

URL=$(printf '%s' "${SUPABASE_URL:-}" | tr -d ' \r\n\t' | sed 's#[./]*$##')
KEY=$(printf '%s' "${SUPABASE_PUBLISHABLE_KEY:-}" | tr -d ' \r\n\t')
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "Secrets SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY nao configurados."
  [ -n "${GITHUB_OUTPUT:-}" ] && echo "ok=0" >> "$GITHUB_OUTPUT"
  exit 1
fi
case "$URL" in https://*) INICIO=sim ;; *) INICIO=NAO ;; esac
echo "URL: ${#URL} caracteres, comeca com https://? $INICIO"

# 15 buscas diferentes (a primeira tambem informa quantos codigos existem no banco)
BUSCAS=(
  "ncm_codes?select=codigo&limit=1"
  "ncm_codes?select=codigo,descricao&digits=like.0101*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.2203*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.6109*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.8471*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.8703*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.3004*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.4011*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.8517*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.1905*&limit=5"
  "ncm_codes?select=codigo,descricao&digits=like.0201*&limit=5"
  "ncm_codes?select=codigo,descricao&descricao=ilike.*camiseta*&limit=5"
  "ncm_codes?select=codigo,descricao&descricao=ilike.*pneu*&limit=5"
  "ncm_codes?select=codigo,descricao&descricao=ilike.*cerveja*&limit=5"
  "ncm_aliquotas?select=codigo,tributo,aliquota&codigo=eq.6109.10.00"
)

OK=0
LINHAS=0
BANCO=0
N=0
T0=$(date +%s)

for BUSCA in "${BUSCAS[@]}"; do
  N=$((N + 1))
  CODE=000
  # ate 3 tentativas por busca, para instabilidade passageira
  for TENT in 1 2 3; do
    rm -f hdr.txt body.txt
    CODE=$(curl -g -s -D hdr.txt -o body.txt -w "%{http_code}" --max-time 20 \
      -H "apikey: $KEY" -H "Prefer: count=exact" \
      "$URL/rest/v1/$BUSCA" || true)
    CODE=${CODE:-000}
    case "$CODE" in 200 | 206) break ;; esac
    [ "$TENT" = "3" ] || sleep 5
  done

  case "$CODE" in
    200 | 206)
      OK=$((OK + 1))
      # Content-Range: "0-4/1234" (linhas devolvidas / total) ou "*/0" (nenhuma linha)
      RANGE=$(grep -i '^content-range:' hdr.txt | tr -d '\r' | awk '{print $2}')
      INTERVALO=${RANGE%%/*}
      TOTAL=${RANGE##*/}
      case "$TOTAL" in '' | *[!0-9]*) TOTAL=0 ;; esac
      if [ -z "$INTERVALO" ] || [ "$INTERVALO" = "*" ]; then
        LIN=0
      else
        LIN=$((${INTERVALO#*-} - ${INTERVALO%-*} + 1))
      fi
      LINHAS=$((LINHAS + LIN))
      [ "$N" = "1" ] && BANCO=$TOTAL
      echo "Busca $N/15: HTTP $CODE, $LIN linhas  ($BUSCA)"
      ;;
    *)
      echo "Busca $N/15: FALHOU, HTTP $CODE  ($BUSCA)"
      [ -f body.txt ] && head -c 200 body.txt && echo
      ;;
  esac
done
rm -f hdr.txt body.txt

DURACAO=$(($(date +%s) - T0))
echo "Resultado: $OK de 15 buscas concluidas, $LINHAS linhas lidas, $BANCO codigos no banco, ${DURACAO}s."

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "ok=$OK"
    echo "linhas=$LINHAS"
    echo "banco=$BANCO"
    echo "duracao=$DURACAO"
  } >> "$GITHUB_OUTPUT"
fi

[ "$OK" = "15" ]
