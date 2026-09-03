// Tiny in-memory flag the restore endpoint flips while it disconnects the
// shared Prisma pool to run `pg_restore --clean` — every other API request
// gets a clear 503 instead of hitting a torn-down connection mid-request.
let active = false;

const setMaintenanceMode = (val) => { active = !!val; };
const isMaintenanceMode = () => active;

module.exports = { setMaintenanceMode, isMaintenanceMode };
