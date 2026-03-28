// Data Models representing the PlantUML Metamodel V2

const Criticality = { LOW: 'low', MED: 'med', HIGH: 'high' };
const NodeType = { SOURCE: 'Source', INGESTION: 'Ingestion', PROCESSING: 'Processing', STORAGE: 'Storage', SERVING: 'Serving' };
const UpdateMode = { STREAM: 'stream', BATCH: 'batch', HYBRID: 'hybrid' };
const FlowType = { STREAM: 'stream', BATCH: 'batch' };
const EnforcementPolicy = { ENFORCE: 'enforce', WARN: 'warn', MONITOR: 'monitor' };
const ClauseType = { SCHEMA: 'Schema', CONSTRAINT: 'Constraint', SLO: 'SLO', COMPATIBILITY: 'Compatibility', RESPONSIBILITY: 'Responsibility' };
const Stage = { INGEST: 'ingest', PROCESS: 'process', STORE: 'store', SERVE: 'serve' };
const Severity = { INFO: 'info', WARN: 'warn', CRITICAL: 'critical' };
const EvidenceStatus = { PASS: 'pass', FAIL: 'fail', DEGRADED: 'degraded' };
const CompatibilityPolicy = { BACKWARD: 'backward', FORWARD: 'forward', FULL: 'full' };

function generateId() { return Math.random().toString(36).substr(2, 9); }

// GOVERNANCE
class Team {
    constructor(name) {
        this.id = generateId();
        this.name = name;
        this.contact = '';
    }
}
class DataProduct {
    constructor(name, domain) {
        this.id = generateId();
        this.name = name;
        this.domain = domain;
        this.owner = null; // Team ID
        this.contains = []; // ArchElement IDs
    }
}

// INTERFACE
class FieldSpec {
    constructor(name, type, required, semantics) {
        this.id = generateId();
        this.name = name;
        this.type = type;
        this.required = required;
        this.semantics = semantics;
    }
}
class DataInterface {
    constructor(name, version) {
        this.id = generateId();
        this.name = name;
        this.version = version;
        this.fields = []; // FieldSpec[]
        this.requiredForConsumer = []; // FieldSpec[]
    }
}

// ARCHITECTURE
class ArchElement {
    constructor(name) {
        this.id = generateId();
        this.name = name;
        this.criticality = Criticality.MED;
    }
}
class DataNode extends ArchElement {
    constructor(name, nodeType) {
        super(name);
        this.nodeType = nodeType;
        this.updateMode = UpdateMode.BATCH;
        this.assetRef = '';
        this.format = '';
        this.keys = '';
        this.partitioning = '';
        this.freshnessTargetMin = 0;
        this.owner = null; // Team ID
    }
}
class DataFlow extends ArchElement {
    constructor(name, fromId, toId, flowType = FlowType.BATCH) {
        super(name);
        this.from = fromId;
        this.to = toId;
        this.flowType = flowType;
        this.protocol = '';
        this.cadenceOrWindow = '';
        this.serialization = '';
        this.deliverySemantics = '';
        this.timeSemantics = '';
        this.uses = []; // DataInterface IDs
    }
}

// CONTRACTS
class Contract {
    constructor(version, policy) {
        this.id = generateId();
        this.version = version;
        this.policy = policy;
        this.status = 'draft';
        this.clauses = []; // Clause[]
        this.owner = null; // Team ID
        this.bindsTo = null; // ArchElement ID
    }
}
class Clause {
    constructor(type, stage, severity, rationale) {
        this.id = generateId();
        this.type = type;
        this.stage = stage;
        this.severity = severity;
        this.rationale = rationale;
    }
}
class SchemaClause extends Clause {
    constructor(stage, severity, rationale, interfaceRef, requiredFields, typeRules) {
        super(ClauseType.SCHEMA, stage, severity, rationale);
        this.interfaceRef = interfaceRef;
        this.requiredFields = requiredFields;
        this.typeRules = typeRules;
    }
}
class ConstraintClause extends Clause {
    constructor(stage, severity, rationale, rule, column, value, window) {
        super(ClauseType.CONSTRAINT, stage, severity, rationale);
        this.rule = rule;
        this.column = column;
        this.value = value;
        this.window = window;
    }
}
class SLOClause extends Clause {
    constructor(stage, severity, rationale, metric, min, max, window) {
        super(ClauseType.SLO, stage, severity, rationale);
        this.metric = metric;
        this.min = min;
        this.max = max;
        this.window = window;
    }
}
class CompatibilityClause extends Clause {
    constructor(stage, severity, rationale, compatPolicy, allowedChanges) {
        super(ClauseType.COMPATIBILITY, stage, severity, rationale);
        this.compatPolicy = compatPolicy;
        this.allowedChanges = allowedChanges;
    }
}
class ResponsibilityClause extends Clause {
    constructor(stage, severity, rationale, responsibility, assigneeTeam) {
        super(ClauseType.RESPONSIBILITY, stage, severity, rationale);
        this.responsibility = responsibility;
        this.assigneeTeam = assigneeTeam;
    }
}

// CONFORMANCE
class ValidationRun {
    constructor(tool, environment) {
        this.id = generateId();
        this.runId = this.id;
        this.timestamp = new Date().toISOString();
        this.tool = tool;
        this.environment = environment;
        this.produces = []; // Evidence IDs
    }
}
class Evidence {
    constructor(timeWindow, status, observedValue, details, clauseId, archElementId) {
        this.id = generateId();
        this.evidenceId = this.id;
        this.timeWindow = timeWindow;
        this.status = status;
        this.observedValue = observedValue;
        this.details = details;
        this.validates = clauseId; // Clause ID
        this.observedOn = archElementId; // ArchElement ID
    }
}
class Violation {
    constructor(message, priority, recommendedAction) {
        this.id = generateId();
        this.violationId = this.id;
        this.detectedAt = new Date().toISOString();
        this.message = message;
        this.priority = priority;
        this.recommendedAction = recommendedAction;
        this.basedOn = null; // Evidence ID
        this.assignedTo = null; // Team ID
        this.element = null; // ArchElement ID
    }
}

// EVOLUTION
class ChangeSet {
    constructor(fromV, toV, breaking, changeSummary, contractId) {
        this.id = generateId();
        this.fromV = fromV;
        this.toV = toV;
        this.breaking = breaking;
        this.changeSummary = changeSummary;
        this.diffOf = contractId; // Contract ID
    }
}
class ImpactReport {
    constructor(notes, changeSetId) {
        this.id = generateId();
        this.impactId = this.id;
        this.generatedAt = new Date().toISOString();
        this.notes = notes;
        this.analyzes = changeSetId;
        this.impactedElements = []; // ArchElement IDs
        this.impactedTeams = []; // Team IDs
    }
}
