# Migracion pendiente: dinero a centavos

## Que paso

El 12-sep-2026 se empujo `schema.prisma` con el dinero en `Int` mientras
`entry.sh` todavia ejecutaba `prisma db push`. Railway auto-desplego y
`db push` convirtio las columnas a `integer` **sin multiplicar por 100**.

No se perdio nada: todos los importes eran dolares enteros
(`sum(Booking.totalAmount)` = 4930 antes y despues). Pero la base quedo
guardando **dolares en una columna que el esquema documenta como centavos**.

La app en produccion sigue mostrando precios correctos porque el codigo los
lee como dolares. La inconsistencia es entre el esquema y los datos, no en
lo que ve el usuario.

## Que falta

Aplicar `centavos.sql` **en el mismo deploy** que el refactor del codigo a
centavos (67 puntos en backend, 9 archivos en web). Por separado no:

- Solo el SQL -> todos los precios se muestran x100.
- Solo el codigo -> todos los precios se muestran /100.

## Como

1. Terminar el refactor a centavos en `backend/src` y `web/src`.
2. Mover `centavos.sql` a `prisma/migrations/<timestamp>_dinero_centavos/migration.sql`.
3. Empujar: `migration-rehearsal.yml` lo ensaya contra una copia de produccion
   antes de que Railway lo aplique.
