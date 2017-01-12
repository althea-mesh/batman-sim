// @flow
const TM = 1000

/*::

type Network = {
  nodes: {
    [key: string]: Node
  },
  edges: {
    [key: string]: Edge
  }
}

type Edge = {
  throughput: number
}

type Node = {
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
      }
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

*/

//   A--B
let modelNetwork = {
  nodes: {
    A: {},
    B: {}
  },
  edges: {
    'B->A': { throughput: 10 },
    'A->B': { throughput: 10 }
  }
}

function initNodes (modelNetwork)/*: Network*/ {
  const network = {
    nodes: {},
    edges: {}
  }
  for (let address in modelNetwork.nodes) {
    let node = network.nodes[address]

    node.address = address
    node.originators = {}
    node.neighbors = {}
    node.ogmSequence = 0
  }

  for (let edgeId in modelNetwork.edges) {
    let [addressA, addressB] = edgeId.split('->')

    network.nodes[addressA].neighbors[addressB] = network.nodes[addressB]
  }

  return network
}

function broadcastOgm (
  self/*: Node*/
) {
  self.ogmSequence++
  for (let neighbor in self.neighbors) {
    const ogm/*: OGM*/ = {
      type: 'OGM',
      sequence: self.ogmSequence,
      originatorAddress: self.address,
      senderAddress: self.address,
      throughput: 255,
      timestamp: Date.now()
    }
    sendPacket(self, neighbor, ogm)
  }
}

function rebroadcastOgm (
  self/*: Node*/,
  ogm/*: OGM*/
) {
  ogm.senderAddress = self.address
  for (let neighbor in self.neighbors) {
    sendPacket(self, neighbor, ogm)
  }
}

function sendPacket (
  self/*: Node*/,
  address/*: string*/,
  payload/*: Object*/
) {
  setTimeout(() => {
    receivePacket(network.nodes[address], JSON.stringify(payload))
  }, Math.random() * 0.1 * TM)
}

function receivePacket (
  self/*: Node*/,
  payload/*: string*/
) {
  payload = JSON.parse(payload)
  switch (payload.type) {
    case 'OGM':
      handleOgm(self, payload)
  }
}

function handleOgm (
  self/*: Node*/,
  ogm/*: OGM*/
) {
  if (ogm.originatorAddress === self.address) {
    return
  }

  adjustOgm(self, ogm)
  updateOriginator(self, ogm)
  rebroadcastOgm(self, ogm)
}

function updateOriginator (
  self/*: Node*/,
  ogm/*: OGM*/
) {
  const originator = self.originators[ogm.originatorAddress]
  if (originator) {
    if (originator.nextHop.throughput < ogm.throughput) {
      originator.nextHop = {
        address: ogm.senderAddress,
        throughput: ogm.throughput
      }
    }
  } else {

  }
}

function adjustOgm (
  self/*: Node*/,
  ogm/*: OGM*/
) {
  /* Update the received throughput metric to match the link
  * characteristic:
  *  - If this OGM traveled one hop so far (emitted by single hop
  *    neighbor) the path throughput metric equals the link throughput.
  *  - For OGMs traversing more than hop the path throughput metric is
  *    the smaller of the path throughput and the link throughput.
  */
  const ownThroughput = network.edges[`${self.address}->${ogm.originatorAddress}`].throughput
  if (self.neighbors[ogm.originatorAddress]) {
    ogm.throughput = ownThroughput
  } else {
    ogm.throughput = Math.min(ownThroughput, ogm.throughput)
  }
}

const network = initNodes(modelNetwork)
broadcastOgm(network.nodes['A'])
