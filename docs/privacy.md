# Centro de privacidad (R10)

Código: `packages/domain/src/privacy.ts`. Tests: `packages/domain/test/rules.test.ts`, `packages/demo-seed/test/corpus.test.ts`.

## Detectores (reglas explicables)
| Detector | Regla | Validación |
|---|---|---|
| email | local@dominio.tld | — |
| payment_card | 13–19 dígitos | Luhn |
| iban | código país + dígitos de control | ISO 13616 mod-97 |
| us_ssn | NNN-NN-NNNN | excluye rangos inválidos |
| ar_cuit | prefijo válido + 8 + verificador | módulo 11 |
| api_secret | prefijos sk-, AKIA, ghp_, xox*- | — |
| phone | 9–15 dígitos | descarta números que pasan Luhn |
| ipv4 | 4 octetos 0–255 | — |

Cada hallazgo guarda detector, explicación, rango y **vista enmascarada**; el valor original no se registra en logs.

## Limitaciones (se muestran en la UI)
Solo patrones listados; no detecta nombres, direcciones ni datos libres; sin OCR; los validadores no prueban que un dato sea real; es una ayuda de revisión, no una garantía legal ni DLP perfecta.

## Flujo
1. Ingesta → escaneo → clasificación sugerida (public/internal/confidential/restricted) y `RedactionReview` pendiente si hay hallazgos.
2. Política (versionada): clasificaciones que requieren revisión antes de proveedores externos, clasificaciones bloqueadas para externos (solo local), consentimiento obligatorio, retención por tipo de dato, detectores habilitados.
3. Decisión de admin: redactar (nueva versión publicada con `[REDACTED:TIPO#n]`), aprobar original o rechazar.
4. Envío externo: requiere consentimiento vigente (`single_run` o `project_30d`) otorgado por un rol autorizado; revocable.
5. Borrado: invalida retrieval y memoria para nuevas llamadas; la evidencia histórica de runs conserva solo referencias según retención declarada.

Los datos sensibles del corpus demo son ficticios o de prueba públicos (tarjeta 4111…, IBAN de ejemplo GB82 WEST…, teléfonos 555, clave falsa `sk-test_…`).
