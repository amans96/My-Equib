
import { apiRequest } from "./api";

export interface Equb {
  id: string;
  name: string;
  description: string | null;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  totalPeriods: number;
  currentPeriod: number;
  status: "PENDING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  currency: string;
  startDate: string;
  endDate: string | null;

  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };

  _count?: {
    memberships: number;
  };
}

export interface Membership {
  id: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  shares: number;
  totalPaid: number;
  missedPayments: number;
  contributionAmount: number;

  equb: Equb;
}

export interface GetEqubsResponse {
  success: boolean;
  count: number;
  equbs: Equb[];
}

export interface GetMyMembershipsResponse {
  success: boolean;
  count: number;
  memberships: Membership[];
}

export interface JoinEqubResponse {
  success: boolean;
  message: string;
  membership: Membership;
  contributionAmount: number;
}

export async function getEqubs(): Promise<GetEqubsResponse> {
  return apiRequest<GetEqubsResponse>("/equbs", {
    method: "GET",
  });
}

export async function getMyMemberships(): Promise<GetMyMembershipsResponse> {
  return apiRequest<GetMyMembershipsResponse>("/memberships/my", {
    method: "GET",
  });
}

export async function requestToJoinEqub(
  equbId: string,
  shares: number = 1
): Promise<JoinEqubResponse> {
  return apiRequest<JoinEqubResponse>(
    `/equbs/${equbId}/join`,
    {
      method: "POST",
      body: JSON.stringify({
        shares,
      }),
    }
  );
}

