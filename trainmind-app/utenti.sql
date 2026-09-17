SELECT u.email, u.role, u."isActive", u."lastLoginAt", o.name AS org, o.tier
FROM users u JOIN organizations o ON o.id = u."organizationId"
ORDER BY o.name, u.role, u.email;
