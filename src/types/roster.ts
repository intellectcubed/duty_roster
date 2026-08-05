export interface Staff {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface RosterEntry {
  id: string;
  staffId: string;
  shiftId: string;
  dutyDate: string;
  status: "scheduled" | "confirmed" | "cancelled";
}
