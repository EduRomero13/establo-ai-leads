/* ============================================================
   ESTABLO AI — USUARIO DE APLICACIÓN CON MÍNIMOS PRIVILEGIOS
   Crea el login/usuario 'establo_app' para que la app Next.js
   NO se conecte como 'sa'.

   Uso (desde el contenedor "database" o con sqlcmd instalado):
     SQLCMD=$(ls /opt/mssql-tools*/bin/sqlcmd | tail -1)
     "$SQLCMD" -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
       -v APP_PASSWORD='UnaClaveFuerte#2026' \
       -i /sql/03_CREAR_USUARIO_APP.sql

   Requisitos:
     - La base 'buyer' ya debe existir (01_CREAR_BD_EL_ESTABLO_V3.sql).
     - La contraseña debe cumplir la política de SQL Server
       (mayúscula, minúscula, número y símbolo; 8+ caracteres).

   Este script es idempotente: si el login/usuario ya existe,
   solo actualiza la contraseña y refuerza los permisos.
   ============================================================ */

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'establo_app')
BEGIN
    CREATE LOGIN establo_app
      WITH PASSWORD = N'$(APP_PASSWORD)',
           CHECK_POLICY = ON,
           CHECK_EXPIRATION = OFF;
    PRINT 'Login establo_app creado.';
END
ELSE
BEGIN
    ALTER LOGIN establo_app WITH PASSWORD = N'$(APP_PASSWORD)';
    PRINT 'Login establo_app ya existía; contraseña actualizada.';
END
GO

USE buyer;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'establo_app')
BEGIN
    CREATE USER establo_app FOR LOGIN establo_app;
    PRINT 'Usuario establo_app creado en buyer.';
END
ELSE
BEGIN
    PRINT 'Usuario establo_app ya existía en buyer.';
END
GO

-- Permisos mínimos: leer/escribir datos y ejecutar procedimientos.
-- No se concede DDL ni acceso a otras bases.
ALTER ROLE db_datareader ADD MEMBER establo_app;
ALTER ROLE db_datawriter ADD MEMBER establo_app;
GRANT EXECUTE TO establo_app;
GO

-- Verificación
SELECT
    dp.name              AS usuario,
    dp.type_desc         AS tipo,
    r.name               AS rol
FROM sys.database_principals dp
LEFT JOIN sys.database_role_members drm ON drm.member_principal_id = dp.principal_id
LEFT JOIN sys.database_principals r      ON r.principal_id = drm.role_principal_id
WHERE dp.name = N'establo_app';
GO
