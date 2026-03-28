// Main Application Controller

const state = {
    nodes: new vis.DataSet(),
    edges: new vis.DataSet(),
    dataNodes: {}, dataFlows: {}, teams: {}, contracts: {},
    evidences: {}, changeSets: {}, impactReports: {},
    dataProducts: {}, dataInterfaces: {}, validationRuns: {}, violations: {},
    selectedElementId: null
};

let network = null;

const IconMap = {
    Source: '\uf1c0', Ingestion: '\uf01c', Processing: '\uf085', Storage: '\uf233', Serving: '\uf0c2',
    Team: '\uf0c0', Contract: '\uf15c', Evidence: '\uf058', ChangeSet: '\uf126', ImpactReport: '\uf898',
    DataProduct: '\uf49e', DataInterface: '\uf1e6', ValidationRun: '\uf492', Violation: '\uf071'
};

const ColorMap = {
    Source: '#f59e0b', Ingestion: '#8b5cf6', Processing: '#ec4899', Storage: '#10b981', Serving: '#3b82f6',
    Team: '#a8a29e', Contract: '#facc15', Evidence: '#10b981', ChangeSet: '#ea580c', ImpactReport: '#ef4444',
    DataProduct: '#06b6d4', DataInterface: '#d946ef', ValidationRun: '#0ea5e9', Violation: '#dc2626'
};

document.addEventListener('DOMContentLoaded', () => {
    initNetwork();
    initDragAndDrop();
    initUIEventListeners();
    initExample();
});

function initExample() {
    const sourceNode = new DataNode('Customer DB', NodeType.SOURCE);
    const servingNode = new DataNode('Analytics API', NodeType.SERVING);
    const team = new Team('Data Platform Team');

    state.dataNodes[sourceNode.id] = sourceNode;
    state.dataNodes[servingNode.id] = servingNode;
    state.teams[team.id] = team;

    state.nodes.add([
        { id: sourceNode.id, label: sourceNode.name, x: -200, y: 0, icon: { code: IconMap.Source, color: ColorMap.Source } },
        { id: servingNode.id, label: servingNode.name, x: 200, y: 0, icon: { code: IconMap.Serving, color: ColorMap.Serving } },
        { id: team.id, label: team.name, x: -200, y: -150, icon: { code: IconMap.Team, color: ColorMap.Team } }
    ]);

    sourceNode.owner = team.id;
    drawAutoEdge(team.id, sourceNode.id, 'owner', ColorMap.Team, 'to', 120);

    const flow = new DataFlow('Customer Sync', sourceNode.id, servingNode.id, FlowType.STREAM);
    state.dataFlows[flow.id] = flow;
    
    const contract = new Contract('1.0', EnforcementPolicy.ENFORCE);
    contract.bindsTo = flow.id;
    contract.clauses.push(new SchemaClause(Stage.INGEST, Severity.CRITICAL, 'Need strict types', 'schema_v1', 'id,name', 'string'));
    state.contracts[contract.id] = contract;

    state.edges.add({
        id: flow.id, from: sourceNode.id, to: servingNode.id, arrows: 'to', dashes: [5, 5], 
        label: flow.name + `\n📋 Contract v${contract.version}`,
        font: { background: ColorMap.Contract, color: '#0f172a', strokeWidth: 0, size: 12 }
    });
}

function getInternalObject(id) {
    return state.dataNodes[id] || state.dataFlows[id] || state.teams[id] || 
           state.contracts[id] || state.evidences[id] || state.changeSets[id] || state.impactReports[id] ||
           state.dataProducts[id] || state.dataInterfaces[id] || state.validationRuns[id] || state.violations[id];
}

function initNetwork() {
    const container = document.getElementById('network-container');
    const data = { nodes: state.nodes, edges: state.edges };
    const options = {
        nodes: { shape: 'icon', icon: { face: '"Font Awesome 6 Free"', weight: "900", size: 50 }, font: { color: '#f8fafc', size: 14, face: 'Inter', strokeWidth: 2, strokeColor: '#0f172a' }, shadow: true },
        edges: { arrows: { to: { enabled: true, scaleFactor: 1 } }, color: { color: '#94a3b8', highlight: '#3b82f6' }, font: { color: '#f8fafc', strokeWidth: 3, strokeColor: '#0f172a', align: 'horizontal' }, smooth: false, width: 2 },
        physics: { barnesHut: { gravitationalConstant: -3000, centralGravity: 0.1, springLength: 200, springConstant: 0.05 } },
        interaction: { hover: true, selectConnectedEdges: false },
        manipulation: {
            enabled: true, initiallyActive: true, addNode: false,
            deleteNode: function(data, callback) { handleDeletion(data.nodes, data.edges); callback(data); hideProperties(); },
            deleteEdge: function(data, callback) { handleDeletion([], data.edges); callback(data); hideProperties(); },
            addEdge: function (edgeData, callback) {
                if (edgeData.from === edgeData.to) return callback(null);
                let fromObj = getInternalObject(edgeData.from);
                let toObj = getInternalObject(edgeData.to);
                
                if (fromObj instanceof DataNode && toObj instanceof DataNode) {
                    const df = new DataFlow('New Flow', edgeData.from, edgeData.to, FlowType.STREAM);
                    state.dataFlows[df.id] = df;
                    edgeData.id = df.id; edgeData.label = df.name; edgeData.font = { align: 'top' }; edgeData.dashes = [5, 5];
                    callback(edgeData); onElementSelected(df.id);
                } else {
                    attemptAutoConnect(edgeData.from, edgeData.to);
                    callback(null); // Managed manually inside attemptAutoConnect
                }
            }
        }
    };
    network = new vis.Network(container, data, options);
    network.on("selectNode", function (params) { if (params.nodes.length > 0) onElementSelected(params.nodes[0]); });
    network.on("selectEdge", function (params) { if (params.edges.length > 0 && params.nodes.length === 0) onElementSelected(params.edges[0]); });
    network.on("deselectNode", function () { hideProperties(); });
    network.on("deselectEdge", function () { hideProperties(); });
    network.on("dragEnd", function (params) {
        if (params.nodes.length === 1) {
            let draggedNodeId = params.nodes[0];
            let sourceObj = getInternalObject(draggedNodeId);
            if (sourceObj instanceof Contract) tryAttachContractToEdge(draggedNodeId, params.pointer.canvas);
        }
    });
}

function initDragAndDrop() {
    const items = document.querySelectorAll('.palette-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('type', item.dataset.type); e.dataTransfer.setData('nodetype', item.dataset.nodetype || ''); });
    });
    const networkContainer = document.getElementById('network-container');
    networkContainer.addEventListener('dragover', (e) => { e.preventDefault(); });
    networkContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const nodeType = e.dataTransfer.getData('nodetype');
        const rect = networkContainer.getBoundingClientRect();
        const DOMx = e.clientX - rect.left;
        const DOMy = e.clientY - rect.top;
        const pos = network.DOMtoCanvas({x: DOMx, y: DOMy});
        const nodeIdAtDropLocation = network.getNodeAt({x: DOMx, y: DOMy});
        const newNodeId = createNodeFromPalette(type, nodeType, pos.x, pos.y);
        
        if (nodeIdAtDropLocation && newNodeId && nodeIdAtDropLocation !== newNodeId) {
            attemptAutoConnect(newNodeId, nodeIdAtDropLocation);
        } else if (newNodeId && type === 'Contract') {
            tryAttachContractToEdge(newNodeId, pos);
        }
    });
}

function createNodeFromPalette(type, nodeType, x, y) {
    let internalObj, nodeData;
    if (type === 'DataNode') {
        internalObj = new DataNode(`${nodeType} Node`, nodeType); state.dataNodes[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: internalObj.name, x: x, y: y, icon: { code: IconMap[nodeType], color: ColorMap[nodeType] } };
    } else if (type === 'Team') {
        internalObj = new Team('New Team'); state.teams[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: internalObj.name, x: x, y: y, icon: { code: IconMap.Team, color: ColorMap.Team } };
    } else if (type === 'Contract') {
        internalObj = new Contract('1.0', EnforcementPolicy.MONITOR); state.contracts[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'Contract v' + internalObj.version, x: x, y: y, icon: { code: IconMap.Contract, color: ColorMap.Contract } };
    } else if (type === 'Evidence') {
        internalObj = new Evidence('24h', EvidenceStatus.PASS, '', '', null, null); state.evidences[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'Evidence', x: x, y: y, icon: { code: IconMap.Evidence, color: ColorMap.Evidence } };
    } else if (type === 'ChangeSet') {
        internalObj = new ChangeSet('v1', 'v2', false, '', null); state.changeSets[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'ChangeSet', x: x, y: y, icon: { code: IconMap.ChangeSet, color: ColorMap.ChangeSet } };
    } else if (type === 'ImpactReport') {
        internalObj = new ImpactReport('Notes...', null); state.impactReports[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'Impact Report', x: x, y: y, icon: { code: IconMap.ImpactReport, color: ColorMap.ImpactReport } };
    } else if (type === 'DataProduct') {
        internalObj = new DataProduct('New Product', 'Core'); state.dataProducts[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: internalObj.name, x, y, icon: { code: IconMap.DataProduct, color: ColorMap.DataProduct } };
    } else if (type === 'DataInterface') {
        internalObj = new DataInterface('v1.0 API', '1.0'); state.dataInterfaces[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'API ' + internalObj.name, x, y, icon: { code: IconMap.DataInterface, color: ColorMap.DataInterface } };
    } else if (type === 'ValidationRun') {
        internalObj = new ValidationRun('Tool', 'Prod'); state.validationRuns[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'Val. Run', x, y, icon: { code: IconMap.ValidationRun, color: ColorMap.ValidationRun } };
    } else if (type === 'Violation') {
        internalObj = new Violation('Error', 'High', 'Fix it'); state.violations[internalObj.id] = internalObj;
        nodeData = { id: internalObj.id, label: 'Violation', x, y, icon: { code: IconMap.Violation, color: ColorMap.Violation } };
    }
    if (nodeData) {
        state.nodes.add(nodeData); network.selectNodes([nodeData.id]); onElementSelected(nodeData.id); return nodeData.id;
    }
    return null;
}

function drawAutoEdge(from, to, label, color, arrows='to', edgeLength) { 
    let edgeObj = { id: generateId(), from, to, label, dashes: true, arrows: arrows, color: { color: color } };
    if (edgeLength) edgeObj.length = edgeLength;
    state.edges.add(edgeObj); 
}

function attemptAutoConnect(sourceId, targetId) {
    let sourceObj = getInternalObject(sourceId);
    let targetObj = getInternalObject(targetId);

    if (sourceObj instanceof Contract && targetObj instanceof DataNode) { sourceObj.bindsTo = targetId; drawAutoEdge(sourceId, targetId, '', ColorMap.Contract, '', 80); renderPropertiesPanel(targetId); }
    else if (sourceObj instanceof Team && targetObj instanceof DataNode) { targetObj.owner = sourceId; drawAutoEdge(sourceId, targetId, 'owner', ColorMap.Team, 'to', 120); }
    else if (sourceObj instanceof Team && targetObj instanceof Contract) { targetObj.owner = sourceId; drawAutoEdge(sourceId, targetId, 'owner', ColorMap.Team, 'to', 120); }
    else if (sourceObj instanceof Team && targetObj instanceof DataProduct) { targetObj.owner = sourceId; drawAutoEdge(sourceId, targetId, 'owner', ColorMap.Team, 'to', 120); }
    else if (sourceObj instanceof DataProduct && targetObj instanceof DataNode) { sourceObj.contains.push(targetId); drawAutoEdge(sourceId, targetId, 'contains', ColorMap.DataProduct, 'to', 100); }
    else if (sourceObj instanceof DataFlow && targetObj instanceof DataInterface) { sourceObj.uses.push(targetId); drawAutoEdge(sourceId, targetId, 'uses', ColorMap.DataInterface, 'to', 80); }
    else if (sourceObj instanceof ValidationRun && targetObj instanceof Evidence) { sourceObj.produces.push(targetId); drawAutoEdge(sourceId, targetId, 'produces', ColorMap.ValidationRun, 'to', 80); }
    else if (sourceObj instanceof Violation && targetObj instanceof Evidence) { sourceObj.basedOn = targetId; drawAutoEdge(sourceId, targetId, 'basedOn', ColorMap.Violation, 'to', 60); }
    else if (sourceObj instanceof Violation && targetObj instanceof Team) { sourceObj.assignedTo = targetId; drawAutoEdge(sourceId, targetId, 'assignedTo', ColorMap.Violation, 'to', 80); }
    else if (sourceObj instanceof Violation && (targetObj instanceof DataNode || targetObj instanceof DataFlow)) { sourceObj.element = targetId; drawAutoEdge(sourceId, targetId, 'element', ColorMap.Violation, 'to', 80); }
    else if (sourceObj instanceof ImpactReport && targetObj instanceof Team) { sourceObj.impactedTeams.push(targetId); drawAutoEdge(sourceId, targetId, 'impacted', ColorMap.ImpactReport, 'to', 80); }
    else if (sourceObj instanceof Evidence && targetObj instanceof Contract) { sourceObj.validates = targetId; drawAutoEdge(sourceId, targetId, 'validates', ColorMap.Evidence, 'to', 80); }
    else if (sourceObj instanceof Evidence && targetObj instanceof DataNode) { sourceObj.observedOn = targetId; drawAutoEdge(sourceId, targetId, 'observedOn', ColorMap.Evidence, 'to', 80); }
    else if (sourceObj instanceof ChangeSet && targetObj instanceof Contract) { sourceObj.diffOf = targetId; drawAutoEdge(sourceId, targetId, 'diffOf', ColorMap.ChangeSet, 'to', 80); }
    else if (sourceObj instanceof ImpactReport && targetObj instanceof ChangeSet) { sourceObj.analyzes = targetId; drawAutoEdge(sourceId, targetId, 'analyzes', ColorMap.ImpactReport, 'to', 80); }
    else if (sourceObj instanceof ImpactReport && targetObj instanceof DataNode) { sourceObj.impactedElements.push(targetId); drawAutoEdge(sourceId, targetId, 'impacted', ColorMap.ImpactReport, 'to', 80); }
}

function renderSelect(label, prop, obj, enumObj) {
    let options = Object.values(enumObj).map(v => `<option value="${v}" ${obj[prop]===v?'selected':''}>${v}</option>`).join('');
    return `<div class="form-group"><label>${label}</label><select onchange="updateProp('${prop}', this.value)">${options}</select></div>`;
}
function renderInput(label, prop, obj, isNum = false) {
    return `<div class="form-group"><label>${label}</label><input type="${isNum?'number':'text'}" value="${obj[prop]}" onchange="updateProp('${prop}', this.value)"></div>`;
}

function renderPropertiesPanel(id) {
    const container = document.getElementById('properties-content');
    container.innerHTML = '';
    let element = getInternalObject(id);
    if (!element) return;

    let content = '';
    if (element instanceof DataNode) {
        content = renderInput('Name', 'name', element) + renderSelect('Criticality', 'criticality', element, Criticality) +
        `<div class="form-group"><label>Node Type</label><input type="text" disabled value="${element.nodeType}"></div>` +
        renderSelect('Update Mode', 'updateMode', element, UpdateMode) + renderInput('Asset Ref', 'assetRef', element) +
        renderInput('Format', 'format', element) + renderInput('Keys', 'keys', element) + renderInput('Partitioning', 'partitioning', element) +
        renderInput('FreshnessTargetMin', 'freshnessTargetMin', element, true);
    } else if (element instanceof DataFlow) {
        content = renderInput('Name', 'name', element) + renderSelect('Criticality', 'criticality', element, Criticality) +
        renderSelect('Flow Type', 'flowType', element, FlowType) + renderInput('Protocol', 'protocol', element) +
        renderInput('Cadence/Window', 'cadenceOrWindow', element) + renderInput('Serialization', 'serialization', element) +
        renderInput('Delivery Semantics', 'deliverySemantics', element) + renderInput('Time Semantics', 'timeSemantics', element);
    } else if (element instanceof Contract) {
        content = renderInput('Version', 'version', element) +
        renderSelect('Status', 'status', element, {D:'draft', A:'active', DP:'deprecated'}) +
        renderSelect('Policy', 'policy', element, EnforcementPolicy) +
        `<div class="form-group"><label>Binds To</label><input type="text" disabled value="${element.bindsTo ? 'Bound' : 'None'}"></div><hr><h3>Clauses</h3><div id="clauses-container" style="margin-top: 10px;">` +
        element.clauses.map(c => `<div class="card"><div class="card-title"><span>${c.type}</span><span class="clause-badge">${c.severity}</span></div><div style="font-size:0.8rem; color: #94a3b8; margin-bottom: 4px;">Stage: ${c.stage}</div><div style="font-size:0.85rem; word-break: break-all; background: rgba(0,0,0,0.2); padding: 4px; border-radius:4px;">${c.rationale}</div></div>`).join('') +
        `</div><button class="btn-primary" style="margin-top:8px; width:100%; justify-content:center" onclick="openClauseModal('${id}')"><i class="fa-solid fa-plus"></i> Add Clause</button>`;
    } else if (element instanceof Team) { content = renderInput('Team Name', 'name', element) + renderInput('Contact', 'contact', element); }
      else if (element instanceof Evidence) { content = renderInput('Time Window', 'timeWindow', element) + renderSelect('Status', 'status', element, EvidenceStatus) + renderInput('Observed Value', 'observedValue', element) + renderInput('Details', 'details', element); }
      else if (element instanceof ChangeSet) { content = renderInput('From Version', 'fromV', element) + renderInput('To Version', 'toV', element) + renderSelect('Breaking', 'breaking', element, {T:'true',F:'false'}) + renderInput('Summary', 'changeSummary', element); }
      else if (element instanceof ImpactReport) { content = `<div class="form-group"><label>Notes</label><textarea rows="4" style="width:100%" onchange="updateProp('notes', this.value)">${element.notes}</textarea></div>`; }
      else if (element instanceof DataProduct) { content = renderInput('Name', 'name', element) + renderInput('Domain', 'domain', element); }
      else if (element instanceof DataInterface) { content = renderInput('Name', 'name', element) + renderInput('Version', 'version', element); }
      else if (element instanceof ValidationRun) { content = renderInput('Tool', 'tool', element) + renderInput('Environment', 'environment', element); }
      else if (element instanceof Violation) { content = renderInput('Message', 'message', element) + renderInput('Priority', 'priority', element) + renderInput('Rec. Action', 'recommendedAction', element); }

    let extraHtml = '';
    if (element instanceof DataNode || element instanceof DataFlow || element instanceof DataProduct) {
        extraHtml = `<hr><div class="form-group"><label>Attached Contracts</label>${renderContractsList(id)}<button class="btn-primary" style="margin-top:8px; width:100%; justify-content:center" onclick="attachNewContract('${id}')"><i class="fa-solid fa-plus"></i> New Contract</button></div>`;
    }
    
    let deleteBtnHtml = `<button class="btn-primary" style="background:#dc2626;border-color:#b91c1c;margin-top:24px;width:100%;justify-content:center;" onclick="deleteSelectedElement('${id}')"><i class="fa-solid fa-trash"></i> Delete Element</button>`;
    container.innerHTML = content + extraHtml + deleteBtnHtml;
}

function onElementSelected(elementId) { state.selectedElementId = elementId; document.getElementById('properties').classList.remove('hidden'); renderPropertiesPanel(elementId); }
function hideProperties() { state.selectedElementId = null; document.getElementById('properties').classList.add('hidden'); }

window.updateProp = function(prop, value) {
    const id = state.selectedElementId;
    let element = getInternalObject(id);
    if (element) {
        element[prop] = value;
        if (state.nodes.get(id)) {
            if (prop === 'name') state.nodes.update({id, label: value});
            if (prop === 'version' && element instanceof Contract) state.nodes.update({id, label: 'Contract v' + value});
        }
        if (state.edges.get(id)) {
            if (prop === 'name') {
                let label = value; let contracts = Object.values(state.contracts).filter(c => c.bindsTo === id);
                if (contracts.length > 0) label += `\n📋 Contract v${contracts[0].version}`;
                state.edges.update({id, label});
            }
            if (prop === 'flowType') state.edges.update({id, dashes: value === FlowType.STREAM ? [5, 5] : false });
        }
    }
    renderPropertiesPanel(id);
};

window.onClauseTypeChange = function() {
    const t = document.getElementById('clause-type').value;
    ['fields-schema', 'fields-constraint', 'fields-slo', 'fields-compat', 'fields-resp'].forEach(id => document.getElementById(id).style.display = 'none');
    if (t === ClauseType.SCHEMA) document.getElementById('fields-schema').style.display = 'block';
    if (t === ClauseType.CONSTRAINT) document.getElementById('fields-constraint').style.display = 'block';
    if (t === ClauseType.SLO) document.getElementById('fields-slo').style.display = 'block';
    if (t === ClauseType.COMPATIBILITY) document.getElementById('fields-compat').style.display = 'block';
    if (t === ClauseType.RESPONSIBILITY) document.getElementById('fields-resp').style.display = 'block';
};

window.openClauseModal = function(contractId) {
    document.getElementById('clause-modal').classList.remove('hidden');
    document.getElementById('clause-modal').dataset.contractId = contractId;
    document.getElementById('clause-form').innerHTML = `
        <div class="form-group"><label>Clause Type</label><select id="clause-type" onchange="onClauseTypeChange()">${Object.values(ClauseType).map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Stage</label><select id="clause-stage">${Object.values(Stage).map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Severity</label><select id="clause-sev">${Object.values(Severity).map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Rationale</label><input type="text" id="clause-rat"></div>
        
        <div id="fields-schema"><div class="form-group"><label>Interface Ref</label><input type="text" id="sch-ref"></div><div class="form-group"><label>Req. Fields</label><input type="text" id="sch-req"></div><div class="form-group"><label>Rules</label><input type="text" id="sch-rules"></div></div>
        <div id="fields-constraint" style="display:none;"><div class="form-group"><label>Rule</label><input type="text" id="cst-rule"></div><div class="form-group"><label>Column</label><input type="text" id="cst-col"></div><div class="form-group"><label>Value</label><input type="text" id="cst-val"></div><div class="form-group"><label>Window</label><input type="text" id="cst-win"></div></div>
        <div id="fields-slo" style="display:none;"><div class="form-group"><label>Metric</label><input type="text" id="slo-met"></div><div class="form-group"><label>Min</label><input type="number" id="slo-min" value="0"></div><div class="form-group"><label>Max</label><input type="number" id="slo-max" value="100"></div><div class="form-group"><label>Window</label><input type="text" id="slo-win"></div></div>
        <div id="fields-compat" style="display:none;"><div class="form-group"><label>Policy</label><select id="cmp-pol">${Object.values(CompatibilityPolicy).map(c => `<option value="${c}">${c}</option>`).join('')}</select></div><div class="form-group"><label>Allowed Changes</label><input type="text" id="cmp-chg"></div></div>
        <div id="fields-resp" style="display:none;"><div class="form-group"><label>Responsibility</label><input type="text" id="rsp-res"></div><div class="form-group"><label>Assignee Team</label><input type="text" id="rsp-team"></div></div>
        <button type="button" class="btn-primary" onclick="submitClause()">Add Clause</button> <button type="button" class="btn-secondary" onclick="closeClauseModal()">Cancel</button>
    `;
};
window.closeClauseModal = function() { document.getElementById('clause-modal').classList.add('hidden'); };
window.submitClause = function() {
    const cid = document.getElementById('clause-modal').dataset.contractId;
    const type = document.getElementById('clause-type').value, stage = document.getElementById('clause-stage').value, sev = document.getElementById('clause-sev').value, rat = document.getElementById('clause-rat').value;
    let clause = null;
    if (type === ClauseType.SCHEMA) clause = new SchemaClause(stage, sev, rat, document.getElementById('sch-ref').value, document.getElementById('sch-req').value, document.getElementById('sch-rules').value);
    else if (type === ClauseType.CONSTRAINT) clause = new ConstraintClause(stage, sev, rat, document.getElementById('cst-rule').value, document.getElementById('cst-col').value, document.getElementById('cst-val').value, document.getElementById('cst-win').value);
    else if (type === ClauseType.SLO) clause = new SLOClause(stage, sev, rat, document.getElementById('slo-met').value, document.getElementById('slo-min').value, document.getElementById('slo-max').value, document.getElementById('slo-win').value);
    else if (type === ClauseType.COMPATIBILITY) clause = new CompatibilityClause(stage, sev, rat, document.getElementById('cmp-pol').value, document.getElementById('cmp-chg').value);
    else if (type === ClauseType.RESPONSIBILITY) clause = new ResponsibilityClause(stage, sev, rat, document.getElementById('rsp-res').value, document.getElementById('rsp-team').value);
    if (state.contracts[cid] && clause) { state.contracts[cid].clauses.push(clause); renderPropertiesPanel(cid); }
    closeClauseModal();
};

window.attachNewContract = function(archElementId) {
    const c = new Contract('1.0', EnforcementPolicy.ENFORCE);
    c.bindsTo = archElementId;
    state.contracts[c.id] = c;

    if (state.nodes.get(archElementId)) {
        let pos = {x: 0, y: 0};
        const p = network.getPositions([archElementId])[archElementId];
        pos = {x: p.x + 100, y: p.y - 100};
        state.nodes.add({ id: c.id, label: 'Contract v' + c.version, x: pos.x, y: pos.y, icon: { code: IconMap.Contract, color: ColorMap.Contract } });
        state.edges.add({ id: generateId(), from: c.id, to: archElementId, dashes: true, arrows: '', color: { color: ColorMap.Contract }, length: 80 });
    } else if (state.edges.get(archElementId)) {
        let df = state.dataFlows[archElementId];
        state.edges.update({
            id: archElementId, label: (df ? df.name : '') + `\n📋 Contract v${c.version}`,
            font: { background: ColorMap.Contract, color: '#0f172a', strokeWidth: 0, size: 12 }
        });
    }
    renderPropertiesPanel(archElementId);
};

function handleDeletion(nodeIds, edgeIds) {
    nodeIds.forEach(id => {
        ['dataNodes','teams','contracts','evidences','changeSets','impactReports','dataProducts','dataInterfaces','validationRuns','violations'].forEach(k => delete state[k][id]);
        Object.keys(state.contracts).forEach(cid => { if (state.contracts[cid].bindsTo === id) delete state.contracts[cid]; });
    });
    edgeIds.forEach(id => {
        delete state.dataFlows[id];
        Object.keys(state.contracts).forEach(cid => { if (state.contracts[cid].bindsTo === id) delete state.contracts[cid]; });
    });
}

window.deleteSelectedElement = function(id) {
    if (state.nodes.get(id) || state.edges.get(id)) {
        network.deleteSelected();
    } else if (state.contracts[id]) {
        let c = state.contracts[id];
        let boundTo = c.bindsTo;
        delete state.contracts[id];
        if (boundTo && state.edges.get(boundTo)) {
            let df = state.dataFlows[boundTo];
            let remaining = Object.values(state.contracts).filter(ct => ct.bindsTo === boundTo);
            let label = df ? df.name : '';
            if (remaining.length) label += `\n📋 Contract v${remaining[0].version}`;
            state.edges.update({id: boundTo, label: label, font: remaining.length ? { background: ColorMap.Contract, color: '#0f172a', strokeWidth: 0, size: 12 } : {}});
        }
        hideProperties();
        if (boundTo) onElementSelected(boundTo);
    } else {
        hideProperties();
    }
};

function renderContractsList(archId) {
    let boundContracts = Object.values(state.contracts).filter(c => c.bindsTo === archId);
    if (boundContracts.length === 0) return `<div style="font-size: 0.8rem; color: #94a3b8;">No contracts attached.</div>`;
    return boundContracts.map(c => `<div class="card" style="cursor:pointer; border-color: ${ColorMap.Contract}" title="Click to view details" onclick="onElementSelected('${c.id}')"><div class="card-title"><i class="fa-solid fa-file-signature"></i> Contract v${c.version}</div><div style="font-size: 0.8rem; color: var(--text-secondary)">Policy: ${c.policy} | Clauses: ${c.clauses.length}</div></div>`).join('');
}

function cleanObj(obj) {
    let res = {};
    for (let k in obj) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '' && (!Array.isArray(obj[k]) || obj[k].length > 0)) res[k] = obj[k]; }
    return res;
}

function loadFromJSON(jsonString) {
    try {
        const payload = JSON.parse(jsonString);
        if (payload.dataNodes) Object.values(payload.dataNodes).forEach(raw => { let obj = new DataNode(); Object.assign(obj, raw); state.dataNodes[raw.id] = obj; });
        if (payload.dataFlows) Object.values(payload.dataFlows).forEach(raw => { let obj = new DataFlow(); Object.assign(obj, raw); state.dataFlows[raw.id] = obj; });
        if (payload.teams) Object.values(payload.teams).forEach(raw => { let obj = new Team(); Object.assign(obj, raw); state.teams[raw.id] = obj; });
        if (payload.dataProducts) Object.values(payload.dataProducts).forEach(raw => { let obj = new DataProduct(); Object.assign(obj, raw); state.dataProducts[raw.id] = obj; });
        if (payload.dataInterfaces) Object.values(payload.dataInterfaces).forEach(raw => { let obj = new DataInterface(); Object.assign(obj, raw); state.dataInterfaces[raw.id] = obj; });
        if (payload.validationRuns) Object.values(payload.validationRuns).forEach(raw => { let obj = new ValidationRun(); Object.assign(obj, raw); state.validationRuns[raw.id] = obj; });
        if (payload.violations) Object.values(payload.violations).forEach(raw => { let obj = new Violation(); Object.assign(obj, raw); state.violations[raw.id] = obj; });
        if (payload.evidences) Object.values(payload.evidences).forEach(raw => { let obj = new Evidence(); Object.assign(obj, raw); state.evidences[raw.id] = obj; });
        if (payload.changeSets) Object.values(payload.changeSets).forEach(raw => { let obj = new ChangeSet(); Object.assign(obj, raw); state.changeSets[raw.id] = obj; });
        if (payload.impactReports) Object.values(payload.impactReports).forEach(raw => { let obj = new ImpactReport(); Object.assign(obj, raw); state.impactReports[raw.id] = obj; });
        if (payload.contracts) Object.values(payload.contracts).forEach(raw => { 
            let obj = new Contract(); Object.assign(obj, raw);
            let hydratedClauses = [];
            if (raw.clauses) { raw.clauses.forEach(c => { let clause; if (c.type === ClauseType.SCHEMA) clause = new SchemaClause(); else if (c.type === ClauseType.CONSTRAINT) clause = new ConstraintClause(); else if (c.type === ClauseType.SLO) clause = new SLOClause(); else if (c.type === ClauseType.COMPATIBILITY) clause = new CompatibilityClause(); else if (c.type === ClauseType.RESPONSIBILITY) clause = new ResponsibilityClause(); else clause = new Clause(); Object.assign(clause, c); hydratedClauses.push(clause); }); }
            obj.clauses = hydratedClauses; state.contracts[raw.id] = obj; 
        });
        if (payload.nodes) state.nodes.add(payload.nodes);
        if (payload.edges) state.edges.add(payload.edges);
        if (network) network.fit();
    } catch (e) { alert("Failed to load JSON file: " + e.message); }
}

function exportToJSON() {
    const payload = { ...state, nodes: state.nodes.get(), edges: state.edges.get() }; delete payload.selectedElementId;
    const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    a.download = "datacontract_model.json"; a.click(); a.remove();
}

function exportToYAML() {
    function downloadItem(filename, text) {
        const a = document.createElement('a'); a.href = "data:text/yaml;charset=utf-8," + encodeURIComponent(text);
        a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    let delay = 0;
    
    let archDoc = { architecture_id: "generated_arch_" + Date.now(), nodes: [], flows: [] };
    Object.values(state.dataNodes).forEach(n => { let ownerTeam = state.teams[n.owner]; archDoc.nodes.push({ id: n.id, name: n.name, type: n.nodeType, owner: ownerTeam ? ownerTeam.name : undefined, criticality: n.criticality, assetRef: n.assetRef, format: n.format, keys: n.keys, partitioning: n.partitioning, freshnessTargetMinutes: n.freshnessTargetMin }); });
    Object.values(state.dataFlows).forEach(f => { archDoc.flows.push({ id: f.id, name: f.name, from: f.from, to: f.to, flowType: f.flowType, protocol: f.protocol, cadence: f.cadenceOrWindow, criticality: f.criticality }); });
    if (archDoc.nodes.length || archDoc.flows.length) { setTimeout(() => downloadItem("1_architecture.yaml", jsyaml.dump(cleanObj(archDoc))), delay); delay += 100; }

    let ifaceDoc = { interfaces: [], flowInterfaceBinding: [] };
    Object.values(state.dataInterfaces).forEach(i => { ifaceDoc.interfaces.push(cleanObj(i)); });
    Object.values(state.dataFlows).forEach(f => { f.uses.forEach(uid => { ifaceDoc.flowInterfaceBinding.push({ flowId: f.id, usesInterface: uid }); }); });
    if (ifaceDoc.interfaces.length > 0) { setTimeout(() => downloadItem("4_interfaces.yaml", jsyaml.dump(ifaceDoc)), delay); delay += 100; }

    let flowContracts = []; let nodeContracts = [];
    Object.values(state.contracts).forEach(c => {
        let ownerTeam = state.teams[c.owner]; let scope = state.dataFlows[c.bindsTo] ? 'flow' : 'node';
        let cDoc = { contract_id: c.id, scope: scope, bindsTo: c.bindsTo, owner: ownerTeam ? ownerTeam.name : undefined, version: c.version, policy: c.policy, clauses: c.clauses.map(cl => cleanObj(cl)) };
        if (scope === 'flow') flowContracts.push(cleanObj(cDoc)); else nodeContracts.push(cleanObj(cDoc));
    });

    if (flowContracts.length > 0) { setTimeout(() => downloadItem("2_contracts_flows.yaml", flowContracts.map(c => jsyaml.dump(c)).join("\n---\n")), delay); delay += 100; }
    if (nodeContracts.length > 0) { setTimeout(() => downloadItem("3_contracts_nodes.yaml", nodeContracts.map(c => jsyaml.dump(c)).join("\n---\n")), delay); delay += 100; }
}

function importFromYAML(yamlString) {
    try {
        let standardizedYaml = yamlString.replace(/={5,}/g, '---');
        const docs = jsyaml.loadAll(standardizedYaml);

        let teamMap = {};
        function getTeamId(name) { if (!name) return null; if (!teamMap[name]) { let t = new Team(name); state.teams[t.id] = t; teamMap[name] = t.id; } return teamMap[name]; }

        docs.forEach(doc => {
            if (!doc) return;
            if (doc.architecture_id) {
                if (doc.nodes) doc.nodes.forEach(n => { let obj = new DataNode(n.name, n.type); obj.id = n.id; obj.criticality = n.criticality || obj.criticality; obj.assetRef = n.assetRef || ''; obj.format = n.format || ''; obj.keys = n.keys || ''; obj.partitioning = n.partitioning || ''; obj.freshnessTargetMin = n.freshnessTargetMinutes || 0; if (n.owner) obj.owner = getTeamId(n.owner); state.dataNodes[obj.id] = obj; });
                if (doc.flows) doc.flows.forEach(f => { let obj = new DataFlow(f.name, f.from, f.to, f.flowType); obj.id = f.id; obj.protocol = f.protocol || ''; obj.cadenceOrWindow = f.cadence || ''; obj.criticality = f.criticality || obj.criticality; state.dataFlows[obj.id] = obj; });
            }
            if (doc.interfaces) {
                doc.interfaces.forEach(i => { let obj = new DataInterface(i.name, i.version); obj.id = i.id; obj.fields = i.fields || []; obj.requiredForConsumer = i.requiredForConsumer || []; state.dataInterfaces[obj.id] = obj; });
                if (doc.flowInterfaceBinding) doc.flowInterfaceBinding.forEach(b => { if (state.dataFlows[b.flowId]) state.dataFlows[b.flowId].uses.push(b.usesInterface); });
            }
            if (doc.contract_id) {
                let obj = new Contract(doc.version, doc.policy); obj.id = doc.contract_id; obj.bindsTo = doc.bindsTo; if (doc.owner) obj.owner = getTeamId(doc.owner);
                if (doc.clauses) doc.clauses.forEach(c => {
                    let clause;
                    if (c.type === ClauseType.SCHEMA) clause = new SchemaClause(c.stage, c.severity, c.notes||c.rationale, c.interfaceRef, c.required_fields, JSON.stringify(c.types));
                    else if (c.type === ClauseType.CONSTRAINT) clause = new ConstraintClause(c.stage, c.severity, c.notes||c.rationale, c.rule, c.column, c.value||c.max, c.window);
                    else if (c.type === ClauseType.SLO) clause = new SLOClause(c.stage, c.severity, c.notes||c.rationale, c.metric, c.min, c.max, c.window);
                    else if (c.type === ClauseType.COMPATIBILITY) clause = new CompatibilityClause(c.stage, c.severity, c.notes||c.rationale, c.compatPolicy, c.allowedChanges);
                    else clause = new Clause(c.type, c.stage, c.severity, c.rationale);
                    clause.id = c.id || clause.id; obj.clauses.push(clause);
                });
                state.contracts[obj.id] = obj;
            }
        });

        Object.values(state.dataNodes).forEach(n => { let pos = {x: Math.random()*800 - 400, y: Math.random()*800 - 400}; state.nodes.add({ id: n.id, label: n.name, x: pos.x, y: pos.y, icon: { code: IconMap[n.nodeType]||IconMap.Source, color: ColorMap[n.nodeType]||ColorMap.Source }}); });
        Object.values(state.teams).forEach(t => { let pos = {x: Math.random()*800 - 400, y: Math.random()*800 - 400}; state.nodes.add({ id: t.id, label: t.name, x: pos.x, y: pos.y, icon: { code: IconMap.Team, color: ColorMap.Team }}); });
        
        Object.values(state.dataFlows).forEach(df => { state.edges.add({ id: df.id, from: df.from, to: df.to, label: df.name, arrows: 'to', dashes: df.flowType === FlowType.STREAM ? [5,5] : false }); });

        Object.values(state.dataNodes).forEach(n => { if (n.owner) attemptAutoConnect(n.owner, n.id); });
        Object.values(state.contracts).forEach(c => { if (c.owner) attemptAutoConnect(c.owner, c.id); if (c.bindsTo) attemptAutoConnect(c.id, c.bindsTo); });
        
        if (network) { network.stabilize(); network.fit(); }
    } catch (e) { alert("Failed to load YAML: " + e.message); }
}

function initUIEventListeners() {
    document.getElementById('palette-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#palette hr').forEach(hr => hr.style.display = q ? 'none' : 'block');
        document.querySelectorAll('.palette-item').forEach(item => {
            item.style.display = item.innerText.toLowerCase().includes(q) ? 'flex' : 'none';
        });
    });
    document.getElementById('btn-draw').addEventListener('click', () => network.addEdgeMode());
    document.getElementById('btn-clear').addEventListener('click', () => {
        state.nodes.clear(); state.edges.clear();
        ['dataNodes','dataFlows','teams','contracts','evidences','changeSets','impactReports','dataProducts','dataInterfaces','validationRuns','violations'].forEach(k => state[k]={});
        hideProperties();
    });
    document.getElementById('btn-export-img').addEventListener('click', () => {
        network.setOptions({
            nodes: { font: { color: '#000000', strokeWidth: 0 } },
            edges: { font: { color: '#000000', strokeWidth: 0 } }
        });
        setTimeout(() => {
            const canvas = document.querySelector('#network-container canvas');
            if (canvas) {
                const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
                a.download = "architecture_snapshot.png"; a.click(); a.remove();
            }
            network.setOptions({
                nodes: { font: { color: '#f8fafc', strokeWidth: 2, strokeColor: '#0f172a' } },
                edges: { font: { color: '#f8fafc', strokeWidth: 3, strokeColor: '#0f172a' } }
            });
        }, 150);
    });
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-import').click());
    document.getElementById('file-import').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        document.getElementById('btn-clear').click();
        
        let allYamlContent = '';
        for (let file of files) {
            let text = await file.text();
            if (file.name.endsWith('.json')) {
                loadFromJSON(text);
            } else {
                allYamlContent += '\n---\n' + text;
            }
        }
        if (allYamlContent) importFromYAML(allYamlContent);
        e.target.value = '';
    });
    document.getElementById('btn-export-json').addEventListener('click', () => exportToJSON());
    document.getElementById('btn-export-yaml').addEventListener('click', () => exportToYAML());
}

function dist2(v, w) { return Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2); }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w); if (l2 === 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2; t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}
function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }
function tryAttachContractToEdge(contractId, pos) {
    let minDist = Infinity; let nearestEdge = null;
    state.edges.get().forEach(edge => {
        let fromNode = state.nodes.get(edge.from); let toNode = state.nodes.get(edge.to);
        if (fromNode && toNode) {
            let pFrom = network.getPositions([fromNode.id])[fromNode.id]; let pTo = network.getPositions([toNode.id])[toNode.id];
            let dist = distToSegment(pos, pFrom, pTo);
            if (dist < 40 && dist < minDist) { minDist = dist; nearestEdge = edge; }
        }
    });
    if (nearestEdge) {
        let sourceObj = getInternalObject(contractId); let targetObj = getInternalObject(nearestEdge.id);
        if (sourceObj instanceof Contract && targetObj instanceof DataFlow) {
            sourceObj.bindsTo = nearestEdge.id;
            state.edges.update({ id: nearestEdge.id, label: targetObj.name + `\n📋 Contract v${sourceObj.version}`, font: { background: ColorMap.Contract, color: '#0f172a', strokeWidth: 0, size: 12 }});
            state.nodes.remove(contractId); onElementSelected(nearestEdge.id); return true;
        }
    }
    return false;
}
