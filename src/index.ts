const TM = 1000
const HOP_PENALTY = 0.058

type Network = {
  nodes: {
    [key: string]: Router
  },
  edges: {
    [key: string]: Edge
  }
}

type Edge = {
  throughput: number
}

type Router = {
  address: string,
  neighbors: {
    [key: string]: {
      address: string
    }
  },
  originators: {
    [key: string]: {
      address: string,
      nextHop: {
        address: string,
        throughput: number
      },
      ogmSequence: number
    }
  },
  ogmSequence: number
}

type OGM = {
  type: string,
  sequence: number,
  originatorAddress: string,
  senderAddress: string,
  throughput: number,
  timestamp: number
}

//  /- B --> C -\
// A             F
//  \- D <-- E -/

let modelNetwork = {
  nodes: {
    A: {},
    B: {},
    C: {},
    D: {},
    E: {},
    F: {}
  },
  edges: {
    'B->A': { throughput: 10 },
    'A->B': { throughput: 10 },

    'A->D': { throughput: 10 },
    'D->A': { throughput: 10 },

    'B->C': { throughput: 10 },
    'C->B': { throughput: 5 },

    'D->E': { throughput: 5 },
    'E->D': { throughput: 10 },

    'C->F': { throughput: 10 },
    'F->C': { throughput: 10 },

    'E->F': { throughput: 10 },
    'F->E': { throughput: 10 },
  }
}

// Used for logging events etc
function dispatch (...args) {
  console.log(args[0])
}

class tokenBucket {
  bucket: number
  throughput: number
  ticksPerSecond: number
  constructor (
    throughput: number,
    ticksPerSecond: number = 10,
  ) {
    this.throughput = throughput
    this.ticksPerSecond = ticksPerSecond
    setInterval(this.tick, 1000 / ticksPerSecond)
  }

  sendBits (bits: number) {
    const newBucket = this.bucket + bits
    if (newBucket > this.throughput) {
      this.bucket = this.throughput
      return false
    }
    this.bucket = newBucket
    return true
  }

  tick () {
    if (this.bucket > 0) {
      this.bucket -= this.throughput / this.ticksPerSecond
    }
  }
}

function initNodes (modelNetwork): Network {
  const network = {
    nodes: {},
    edges: modelNetwork.edges
  }

  for (let address in modelNetwork.nodes) {
    const node: Router = {
      address: address,
      originators: {},
      neighbors: {},
      ogmSequence: 0
    }

    network.nodes[address] = node
  }

  for (let edgeId in modelNetwork.edges) {
    let [addressA, addressB] = edgeId.split('->')

    network.nodes[addressA].neighbors[addressB] = {
      address: addressB
    }
  }

  return network
}

function broadcastOgm (
  self: Router
) {
  self.ogmSequence++
  for (let address in self.neighbors) {
    const ogm: OGM = {
      type: 'OGM',
      sequence: self.ogmSequence,
      originatorAddress: self.address,
      senderAddress: self.address,
      throughput: 255,
      timestamp: Date.now()
    }
    sendPacket(self, address, ogm)
  }
}

function rebroadcastOgm (
  self: Router,
  ogm: OGM
) {
  ogm.senderAddress = self.address
  for (let neighbor in self.neighbors) {
    sendPacket(self, neighbor, ogm)
  }
}

function sendPacket (
  self: Router,
  address: string,
  payload: Object
) {
  setTimeout(() => {
    dispatch('sent packet')
    receivePacket(network.nodes[address], JSON.stringify(payload))
  }, Math.random() * 0.1 * TM)
}

function receivePacket (
  self: Router,
  payload
) {
  payload = JSON.parse(payload)
  switch (payload.type) {
    case 'OGM':
      handleOgm(self, payload)
  }
}

function handleOgm (
  self: Router,
  ogm: OGM
) {
  if (ogm.originatorAddress === self.address) {
    return
  }

  adjustOgm(self, ogm)
  if (!updateOriginator(self, ogm).sequenceTooLow) {
    rebroadcastOgm(self, ogm)
  }
}

function updateOriginator (
  self: Router,
  ogm: OGM
)/*: { sequenceTooLow: boolean }*/ {
  const originator = self.originators[ogm.originatorAddress]

  // If this originator is already in the node's originator list
  if (originator) {
    // if the sequence is too low, stop processing
    if (ogm.sequence <= originator.ogmSequence) {
      return { sequenceTooLow: true }
    }
    // If the throughput from this ogm is better, replace the next hop
    if (originator.nextHop.throughput < ogm.throughput) {
      originator.nextHop = {
        address: ogm.senderAddress,
        throughput: ogm.throughput
      }
    }
  // If this originator is not already in the node's originator list, add it
  } else {
    self.originators[ogm.originatorAddress] = {
      ogmSequence: ogm.sequence,
      address: ogm.originatorAddress,
      nextHop: {
        address: ogm.senderAddress,
        throughput: ogm.throughput
      }
    }
  }
  return { sequenceTooLow: false }
}

function adjustOgm (
  self/*: Router*/,
  ogm/*: OGM*/
) {
  /* Update the received throughput metric to match the link
  * characteristic:
  *  - If this OGM traveled one hop so far (emitted by single hop
  *    neighbor) the path throughput metric equals the link throughput.
  *  - For OGMs traversing more than one hop the path throughput metric is
  *    the smaller of the path throughput and the link throughput.
  */
  const linkThroughput = network.edges[`${self.address}->${ogm.senderAddress}`].throughput
  if (self.neighbors[ogm.originatorAddress]) {
    ogm.throughput = linkThroughput
  } else {
    ogm.throughput = Math.min(linkThroughput, ogm.throughput)
  }

  // Forward penalty
  ogm.throughput = ogm.throughput * (1 - HOP_PENALTY)
}

const network = initNodes(modelNetwork)

broadcastOgm(network.nodes['A'])
broadcastOgm(network.nodes['B'])
broadcastOgm(network.nodes['C'])
broadcastOgm(network.nodes['D'])
broadcastOgm(network.nodes['E'])
broadcastOgm(network.nodes['F'])

setTimeout(() => console.log(network), 5000)
