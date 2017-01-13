# Batman Sim

This is a light simulator of the Batman V routing protocol. It is definitely not accurate, and there's an emphasis on only coding the features and attributes necessary for any given test I am doing.

It's also live online at: [https://jsfiddle.net/jh9wvaef/](https://jsfiddle.net/jh9wvaef/). It's been tested in Chrome, and it uses a lot of es6 that may or may not work in other browsers at the time that you read this. I'm using Flow typing, but with the comment syntax so that it runs as regular JS.

Look in the console for a list of edges and nodes. Each node has an `originators` property storing the best next hop and estimated throughput to all the other nodes in the network.