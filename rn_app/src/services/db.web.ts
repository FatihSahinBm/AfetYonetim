// Web platformu için sahte (mock) db modülü.
// Web üzerinde SQLite yerine sadece dummy bir arayüz döner.

export const initDb = async () => {
  console.log('initDb called on web - skipped');
};

export const getDb = async () => {
  return {
    runAsync: async () => {},
    getAllAsync: async () => [],
    getFirstAsync: async () => null,
  };
};

export const insertLocalMessage = async () => {};
export const getLocalMessages = async () => [];
export const updateMessageStatus = async () => {};
export const getPendingMessages = async () => [];

export const insertLocalEmergencyReport = async () => {};
export const getLocalEmergencyReports = async () => [];
export const updateEmergencyReportStatus = async () => {};
export const getPendingEmergencyReports = async () => [];

export const insertLocalHouseholdMember = async () => {};
export const getLocalHouseholdMembers = async () => [];
