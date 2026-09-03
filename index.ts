export type CaseStatus =
  | "OPEN" | "IN_PROGRESS" | "WAITING_APPROVAL"
  | "WAITING_PARTS" | "READY_FOR_DELIVERY" | "CLOSED";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface Customer { id:string; name:string; phone:string; notes?:string }
export interface Motorcycle { id:string; customer_id:string; plate:string; brand?:string; model?:string; year?:number; mileage:number }
export interface ServiceCase { id:string; customer_id:string; motorcycle_id:string; complaint:string; diagnosis?:string; status:CaseStatus; priority:Priority }
export interface Estimate { id:string; case_id:string; subtotal:number; discount:number; total:number; approved_at?:string }
