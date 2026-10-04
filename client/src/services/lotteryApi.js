import api from "./api";

// Get/create the lottery for a specific payment period
export const getLottery = async (periodId) => {
  const response = await api.get(
    `/payment-periods/${periodId}/lottery`
  );

  return response.data;
};

// Get all active members and their lottery status
export const getLotteryMembers = async (periodId) => {
  const response = await api.get(
    `/payment-periods/${periodId}/lottery/members`
  );

  return response.data;
};

// Automatically add verified members
export const prepareLottery = async (periodId) => {
  const response = await api.post(
    `/payment-periods/${periodId}/lottery/prepare`
  );

  return response.data;
};

// Manually add a member
export const addLotteryMember = async (
  periodId,
  membershipId
) => {
  const response = await api.post(
    `/payment-periods/${periodId}/lottery/members/${membershipId}`
  );

  return response.data;
};

// Remove a member
export const removeLotteryMember = async (
  periodId,
  membershipId
) => {
  const response = await api.delete(
    `/payment-periods/${periodId}/lottery/members/${membershipId}`
  );

  return response.data;
};

// Remove all previous winners
export const removePreviousWinners = async (periodId) => {
  const response = await api.delete(
    `/payment-periods/${periodId}/lottery/previous-winners`
  );

  return response.data;
};

// Freeze the pool and start the lottery
export const startLottery = async (periodId) => {
  const response = await api.post(
    `/payment-periods/${periodId}/lottery/start`
  );

  return response.data;
};

// Draw the winner
export const drawLottery = async (periodId) => {
  const response = await api.post(
    `/payment-periods/${periodId}/lottery/draw`
  );

  return response.data;
};

// Get lottery history for an Equb
export const getLotteryHistory = async (equbId) => {
  const response = await api.get(
    `/equbs/${equbId}/lottery/history`
  );

  return response.data;
};