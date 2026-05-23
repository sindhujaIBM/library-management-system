export type Role = 'member' | 'librarian';
export type LoanStatus = 'active' | 'returned';
export type AlertType = 'demand_order' | 'stale_auction' | 'series_release';
export type AlertStatus = 'pending' | 'approved' | 'rejected';

export interface Book {
  ISBN: string;
  title: string;
  author: string;
  genre: string;
  series?: string;
  seriesPosition?: number;
  releaseDate?: string;
  totalCopies: number;
  availableCopies: number;
  copiesOnLoan: number;
  lastBorrowedDate?: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  loanId: string;
  ISBN: string;
  userId: string;
  userEmail: string;
  userName: string;
  bookTitle: string;
  bookAuthor: string;
  checkoutDate: string;
  returnDueDate: string;
  returnedDate?: string;
  status: LoanStatus;
  renewalCount: number;
  autoRenewedAt?: string;
  isOverdue?: boolean;
}

export interface User {
  userId: string;
  email: string;
  name: string;
  role: Role;
  googleId: string;
  createdAt: string;
}

export interface WaitlistEntry {
  ISBN: string;
  userId: string;
  userEmail: string;
  userName: string;
  joinedAt: string;
  position: number;
}

export interface AdminAlert {
  alertId: string;
  type: AlertType;
  status: AlertStatus;
  payload: Record<string, unknown>;
  generatedAt: string;
  resolvedAt?: string;
}
