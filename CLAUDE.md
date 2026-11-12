@AGENTS.md

## Journal d'administration

Toute Server Action de `lib/actions/` journalise ses écritures (`logAdminAction`, `lib/audit/adminLog.ts`)
ou figure dans la table `EXEMPT` de `__tests__/unit/actionsLogged.test.ts` avec sa raison. Types de cible
(`AdminTargetType`) : `user`, `restaurant`, `kbis`, `config`, `link` (liens courts et réglages des stores,
page « Liens & QR »). Liens courts : une écriture dont le journal échoue est annulée et refusée
(`adminLogRefusal(ADMIN_LOG_WRITE_FAILED_MESSAGE)`) ; les écritures plus anciennes renvoient encore
`auditLogged: false`. Voir le README (sections P10).
