import { apiRequest } from "./api";

export type LotteryHistoryItem = {
    periodId: string;
    periodNumber: number;
    startDate: string;
    dueDate: string;
    periodStatus: string;

    lotteryId: string | null;
    lotteryStatus:
    | "PENDING"
    | "READY"
    | "RUNNING"
    | "COMPLETED"
    | "CANCELLED"
    | null;

    historyStatus:
    | "NOT_DRAWN"
    | "DRAW_IN_PROGRESS"
    | "COMPLETED";

    startedAt: string | null;
    executedAt: string | null;

    winner: {
        id: string;
        firstName: string;
        lastName: string;
        profileImage: string | null;
    } | null;
};

type LotteryHistoryResponse = {
    success: boolean;
    message: string;
    data: LotteryHistoryItem[];
};

export const getLotteryHistory = async (
    equbId: string
): Promise<LotteryHistoryItem[]> => {
    const response = await apiRequest<LotteryHistoryResponse>(
        `/equbs/${equbId}/lottery/history`
    );

    return response.data ?? [];
};