const createId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

const CustomerStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive"
};

const CaseStatus = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_APPROVAL: "waiting_approval",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

const TaskStatus = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done"
};

function createCustomer(data) {
  return {
    id: createId("CUS"),
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
    notes: data.notes || null,
    status: CustomerStatus.ACTIVE,
    createdAt: new Date().toISOString()
  };
}

function createMotorcycle(data) {
  return {
    id: createId("MOTO"),
    customerId: data.customerId,
    brand: data.brand,
    model: data.model || null,
    year: data.year || null,
    color: data.color || null,
    plateNumber: data.plateNumber || null,
    engineNumber: data.engineNumber || null,
    chassisNumber: data.chassisNumber || null,
    createdAt: new Date().toISOString()
  };
}

function createCase(data) {
  return {
    id: createId("CASE"),
    customerId: data.customerId,
    motorcycleId: data.motorcycleId,
    description: data.description || "",
    status: CaseStatus.OPEN,
    createdAt: new Date().toISOString()
  };
}

function createTask(data) {
  return {
    id: createId("TASK"),
    caseId: data.caseId,
    title: data.title,
    technicianId: data.technicianId || null,
    status: TaskStatus.TODO,
    estimatedCost: Number(data.estimatedCost || 0),
    actualCost: Number(data.actualCost || 0),
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  createId,
  createCustomer,
  createMotorcycle,
  createCase,
  createTask,
  CustomerStatus,
  CaseStatus,
  TaskStatus
};
