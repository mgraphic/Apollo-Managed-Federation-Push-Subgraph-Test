const { ApolloServer, gql } = require('apollo-server');
const { buildFederatedSchema } = require('@apollo/federation');
const fetch = require('node-fetch');
const fs = require('file-system');

const port = 4002;
const apiUrl = 'http://localhost:3000';

const typeDefs = gql`
    type Mission {
        id: ID!
        crew: [Astronaut]
        designation: String!
        startDate: String
        endDate: String
    }

    extend type Astronaut @key(fields: "id") {
        id: ID! @external
        missions: [Mission]
    }

    extend type Query {
        mission(id: ID!): Mission
        missions: [Mission]
    }
`;

const resolvers = {
    Astronaut: {
        async missions(astronaut) {
            const res = await fetch(`${apiUrl}/missions`);
            const missions = await res.json();

            return missions.filter(({ crew }) =>
                crew.includes(parseInt(astronaut.id))
            );
        },
    },
    Mission: {
        crew(mission) {
            return mission.crew.map((id) => ({ __typename: 'Astronaut', id }));
        },
    },
    Query: {
        mission(_, { id }) {
            return fetch(`${apiUrl}/missions/${id}`).then((res) => res.json());
        },
        missions() {
            return fetch(`${apiUrl}/missions`).then((res) => res.json());
        },
    },
};

const server = new ApolloServer({
    schema: buildFederatedSchema([{ typeDefs, resolvers }]),
});

(async () => {
    await server.listen({ port }).then(({ url }) => {
        console.log(`Astronauts service ready at ${url}`);
    });

    const sdl = await server.executeOperation({
        query: 'query {_service { sdl } }',
    });

    if (!sdl.errors) {
        // console.log('RESULT:', sdl.data._service.sdl);

        fs.writeFile('missions.graphql', sdl.data._service.sdl);
    }
})();
