export type Contact = {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
};

export type LineItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export type Deal = {
  id: string;
  dealname: string;
  amount: number;
  stage: string;
  createdAt?: string;
  lineItems?: LineItem[];
};

export type ConcurrencyMeta = {
  cache: "hit" | "miss";
  coalesced: boolean;
  apiCallsSaved: number;
  retries: number;
  ts: string;
};

export type ContactResponse = {
  contact: Contact | null;
  deals: Deal[];
  meta: ConcurrencyMeta;
};
