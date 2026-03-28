# Data Contract Architect

Data Contract Architect is a web-based, interactive tool designed for modeling and visualizing data architectures and contracts. It provides a drag-and-drop interface to build complex data networks, define contracts between data nodes, and export the architectures for integration with modern data engineering workflows.

## Features

- **Interactive Canvas**: Drag and drop nodes onto a visual canvas to design your data architecture.
- **Rich Elements Palette**: Supports various node types including Sources, Ingestion, Processing, Storage, Serving, Teams, Data Products, Contracts, Interfaces, Validation Runs, Evidences, Violations, ChangeSets, and Impact Reports.
- **Node Connections**: Visually connect different components to establish relationships and data flows.
- **Properties Panel**: Inspect and edit the properties of individual nodes and connections dynamically.
- **Import & Export**:
  - Export your architecture to JSON or YAML formats.
  - Export the visual graph as an image snapshot.
  - Import existing architectures from `.json` or `.yaml/.yml` files.
- **Real-Time Validation**: Includes built-in error handling and dynamic clause addition for contracts.

## Technologies Used

- **HTML5 & CSS3**: For structure and styling, utilizing Google Fonts (Inter) and FontAwesome icons.
- **Vanilla JavaScript**: For core application logic (`app.js`, `model.js`).
- **[vis-network](https://visjs.github.io/vis-network/docs/network/)**: For high-performance graph and network visualizations.
- **[js-yaml](https://github.com/nodeca/js-yaml)**: For fast, reliable YAML parsing and generation natively in the browser.

## How to Run

1. Clone or download the repository.
2. The project consists of static front-end files. No server setup or build step is required.
3. Simply open `index.html` in any modern web browser (e.g., Chrome, Firefox, Edge, Safari) to use the application.

## Usage Guide

1. **Add Nodes**: Drag items from the **Elements** sidebar (left) and drop them onto the central canvas.
2. **Connect Nodes**: Click the **Connect** button in the top toolbar to enter connection mode, then simply drag a line from one node to another.
3. **Edit Properties**: Click on any node or edge to automatically open the **Properties** panel (right). Here, you can edit attributes, references, and add custom clauses for contracts.
4. **Save Work**: Click the **JSON** or **YAML** buttons in the header to download your architecture as code. You can also capture an image of the architecture using the **Snapshot** button.
5. **Load Work**: Click the **Import** button to load a previously downloaded architecture file back onto the canvas.
