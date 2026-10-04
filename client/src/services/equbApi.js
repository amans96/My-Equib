
import api from "./api";

// Get Equbs belonging to the authenticated admin
export const getEqubs = async () => {
  const response = await api.get("/equbs");
  return response.data;
};

// Get one Equb by its ID
export const getEqubById = async (equbId) => {
  const response = await api.get(`/equbs/${equbId}`);
  return response.data;
};

// Create a new Equb
export const createEqub = async (equbData) => {
  const response = await api.post("/equbs", equbData);
  return response.data;
};

// Update an existing Equb
export const updateEqub = async (equbId, equbData) => {
  const response = await api.patch(`/equbs/${equbId}`, equbData);
  return response.data;
};

// Delete an Equb
export const deleteEqub = async (equbId) => {
  const response = await api.delete(`/equbs/${equbId}`);
  return response.data;
};

