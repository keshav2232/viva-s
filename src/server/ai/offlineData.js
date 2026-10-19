/** Reference answers used by the offline (no-AI) grader and question bank. */
export const DEFAULT_CORRECT_ANSWERS = {
  // Thermodynamics
  "Carnot thermal boundaries": "The Carnot cycle consists of two isothermal and two adiabatic processes. Reaching 100% thermal efficiency requires the cold sink temperature (T_C) to be absolute zero (0 K), which is physically impossible according to the Third Law of Thermodynamics.",
  "Reversible entropy degradation": "In any real process, some energy is degraded to a lower grade of heat. Mathematically, entropy generation (S_gen) is strictly positive (S_gen > 0) for irreversible processes, representing energy degradation.",
  "Lost exergy work": "Exergy is the maximum useful work potential of a system. Lost exergy work (or exergy destruction) is directly proportional to entropy generation: I = T_0 * S_gen, where T_0 is the environment temperature.",
  "Third law absolute zero": "The Third Law of Thermodynamics states that the entropy of a pure crystalline substance approaches zero as temperature approaches absolute zero. It physically limits the cold sink temperature, preventing 100% Carnot efficiency.",
  "First Law Open Systems": "For open control volumes, the First Law of Thermodynamics accounts for mass transfer: Q_dot - W_dot = sum(m_out * h_out) - sum(m_in * h_in) + dE/dt, accounting for flow enthalpy of mass streams crossing control boundaries.",
  "Flow work enthalpy": "Enthalpy (H = U + PV) represents the total energy of a flowing fluid, combining internal energy (U) and flow work (PV) required to push the mass across control boundaries.",
  "Transient heat transfer": "Transient systems undergo state changes over time (dE/dt != 0). Energy balance models must integrate transient parameters across time steps to track heat and mass accumulation.",
  "Steady-flow energy boundaries": "In steady-flow energy equations (SFEE), states do not vary with time (dE/dt = 0). Energy input (heat, mass flow enthalpy, kinetic, potential) strictly equals energy output.",
  "Clapeyron equations": "The Clapeyron equation describes phase boundary slopes on a P-T diagram: dP/dT = L / (T * delta_v), where L is latent heat and delta_v is the specific volume change during phase transition.",
  "Phase boundary derivations": "Derivations utilize Maxwell relations and Gibbs free energy equality (g_liq = g_vap) along the coexistence line to derive pressure-temperature relationship limits.",
  "Sublimation slopes": "The slope dP/dT is much steeper for sublimation than vaporization because the specific volume of the solid phase is significantly smaller than the liquid phase, leading to a larger change in specific volume delta_v.",
  "Triple point limits": "The triple point represents unique temperature and pressure conditions where solid, liquid, and gas phases coexist in thermodynamic equilibrium (e.g., 273.16 K for water).",

  // Data Structures
  "Arrays & Arraylists": "Arrays are fixed-size contiguous memory blocks offering O(1) random access. ArrayLists are dynamically resizable, using automatic copy-and-reallocate operations when the load capacity is reached.",
  "Stack LIFO boundaries": "A stack is a Last-In, First-Out structure. Key operations are Push and Pop, both operating at O(1) complexity. Stack overflow/underflow boundary checks prevent memory access violations.",
  "Queue FIFO parameters": "A queue is a First-In, First-Out structure. Enqueue adds to the rear, and Dequeue removes from the front, both operating in O(1) time. Circular queues optimize space via modulo indexing.",
  "Linked list traversal": "Linked lists consist of non-contiguous nodes linked by references. Traversal requires linear O(N) pointer-chasing, unlike arrays which support O(1) index-based jumps.",
  "Binary Search Trees": "A BST is a node-based binary tree where left children are smaller and right children are larger. Search, insertion, and deletion operate in O(log N) average time, but degrade to O(N) if unbalanced.",
  "AVL self-balancing logic": "AVL trees are self-balancing BSTs where the balance factor (height(left) - height(right)) of any node must be in {-1, 0, 1}. Violations are corrected using single or double rotations (LL, RR, LR, RL).",
  "Red-black tree margins": "Red-Black trees balance using node color attributes (Red/Black) and 5 strict color rules. They guarantee O(log N) operations with fewer rotations than AVL trees on insertion/deletion.",
  "Graph representations": "Graphs are represented using Adjacency Matrices (O(V^2) space, fast edge lookup) or Adjacency Lists (O(V+E) space, efficient neighbor traversal).",
  "Hash collisions buckets": "Hash collisions occur when distinct keys hash to the same table index. Open addressing (linear/quadratic probing, double hashing) or separate chaining (linked list buckets) resolve collisions.",
  "Probing techniques": "Linear probing checks consecutive slots (i + 1, i + 2), leading to primary clustering. Quadratic probing uses polynomial increments (i + k^2), reducing clustering issues.",
  "Graph BFS queues": "Breadth-First Search explores graph nodes level-by-level using a FIFO Queue to track frontier nodes, operating in O(V + E) time.",
  "DFS recursive stacks": "Depth-First Search explores path branches as deep as possible before backtracking, utilizing a LIFO Stack (explicit or via recursion) to track traversal paths.",

  // Machine Design
  "Static stress limits": "Static design limits ensure materials do not yield or fracture under constant loading. Ductile materials use the Distortion Energy theory (von Mises), while brittle materials use Maximum Normal Stress theory.",
  "Alternating stress fatigue": "Fatigue occurs under cyclic loading at stresses far below static yield limits. Micro-cracks initiate at stress concentrations and propagate until sudden catastrophic failure.",
  "Goodman line diagrams": "The Goodman relation maps safe combinations of mean stress (S_m) and alternating stress (S_a): S_a / S_e + S_m / S_ut = 1, where S_e is endurance limit and S_ut is ultimate tensile strength.",
  "Soderberg yield boundaries": "The Soderberg fatigue model is highly conservative, using yield strength (S_yt) instead of ultimate strength: S_a / S_e + S_m / S_yt = 1.",
  "Torsional stress shafts": "Torsion creates shear stress in a circular shaft: tau = T * r / J, where T is torque, r is radius, and J is polar moment of inertia (J = pi * d^4 / 32).",
  "Stress flow singularties": "Stress concentrations arise at geometric discontinuities (holes, fillets, keyways) where stress flow lines crowd together, raising maximum stress by a factor of K_t.",
  "Fillet radii mitigation": "Increasing the fillet radius creates a gentler transition between shaft diameters, smoothing out the flow lines of stress and lowering the stress concentration factor K_t.",
  "Shaft keys grooves": "Keyways transmit torque between shafts and gears. Because they are sharp internal cutouts, they act as major stress concentration zones, reducing the shaft's fatigue limit.",
  "Sommerfeld lubrication coefficient": "The Sommerfeld number characterizes hydrodynamic journal bearings: S = (r/c)^2 * (mu * N) / P, determining friction coefficient, film thickness, and lubricant flow rate.",
  "Journal bearings eccentrity": "Eccentricity (e) is the radial offset of the shaft center under load. The eccentricity ratio (epsilon = e/c) determines the minimum oil film thickness required to prevent metal-to-metal contact.",
  "Spur root teeth bending": "Gear teeth experience bending stress at the root fillet under tangential tooth loads. It is modeled as a cantilever beam using the Lewis formula.",
  "Lewis stress AGMA values": "The classical Lewis formula (sigma = W_t / (F * m * Y)) is modified by AGMA factors (dynamic, overload, size, distribution factors) to compute precise gear tooth bending fatigue limits.",

  // Computer Networks
  "OSI 7-layer boundaries": "The OSI model consists of 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application. A correct answer must define the layers, boundaries, and headers added at each layer.",
  "TCP/IP protocol suites": "The TCP/IP model has 4 layers: Link, Internet, Transport, Application. It is a practical implementation model, unlike the theoretical OSI model.",
  "Transmission mediums bandwidths": "Bandwidth is the maximum data transfer rate. Transmission mediums include guided (copper, fiber optic) and unguided (wireless) media, with fiber optic offering the highest bandwidth due to light propagation.",
  "Packet switching latency": "Packet switching divides data into packets. Latency consists of propagation delay, transmission delay, queuing delay, and processing delay.",
  "TCP flow congestion controls": "TCP uses flow control (sliding window via receiver window) to prevent overwhelming the receiver, and congestion control (Slow Start, Congestion Avoidance, Fast Retransmit, Fast Recovery via cwnd) to prevent network collapse.",
  "UDP boundary payloads": "UDP is a connectionless, unreliable protocol with low overhead. A payload is limited to a maximum of 65,535 bytes including the 8-byte header.",
  "Dijkstra routing matrices": "Dijkstra's algorithm finds the shortest path in a weighted graph from a single source. It uses a greedy approach and requires non-negative edge weights.",
  "IP addressing subnetting": "IP addressing divides network into subnets using a subnet mask. Classless Inter-Domain Routing (CIDR) allows flexible allocation of IP addresses.",
  "DNS lookup procedures": "DNS lookup translates domain names to IP addresses recursively: Local DNS -> Root DNS -> TLD DNS -> Authoritative DNS.",
  "HTTP secure handshakes": "HTTPS uses TLS/SSL handshake. It involves asymmetric encryption for key exchange and symmetric encryption for session data transfer, using certificate authority validation.",
  "Public key cryptography": "Asymmetric cryptography uses a public key for encryption and a private key for decryption (e.g. RSA, ECC). It provides confidentiality, integrity, and non-repudiation.",
  "Firewalls packet filters": "Packet filters inspect packets at the Network/Transport layers (IP and Port numbers) to permit or deny traffic based on firewall rules."
};
