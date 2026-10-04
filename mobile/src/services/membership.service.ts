import { apiRequest } from "./api";
import { getToken } from "./storage";

export interface Membership {
  id: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  shares: number;
  totalPaid: number;
  missedPayments: number;
  contributionAmount: number;

  equb: {
    id: string;
    name: string;
    description: string | null;
    contributionAmount: number;
    frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    totalPeriods: number;
    currentPeriod: number;
    status: string;
    currency: string;
    startDate: string;
    endDate: string | null;
  };
}

interface GetMyMembershipsResponse {
  success: boolean;
  count: number;
  memberships: Membership[];
}

interface JoinEqubResponse {
  success: boolean;
  message: string;
  membership: Membership;
  contributionAmount: number;
}

export async function getMyMemberships(): Promise<GetMyMembershipsResponse> {
  const token = await getToken();

  if (!token) {
    throw new Error("You are not logged in.");
  }

  return apiRequest<GetMyMembershipsResponse>("/memberships/my", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function requestToJoinEqub(
  equbId: string,
  shares: number
): Promise<JoinEqubResponse> {
  const token = await getToken();

  if (!token) {
    throw new Error("You are not logged in.");
  }

  return apiRequest<JoinEqubResponse>(`/equbs/${equbId}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shares,
    }),
  });
}