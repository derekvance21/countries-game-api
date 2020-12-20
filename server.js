require("dotenv").config();
var _ = require("lodash")
var faunadb = require('faunadb'),
q = faunadb.query
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
var cors = require('cors')

const app = require('express')()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors())

var client = new faunadb.Client({secret: process.env.FAUNADB_SECRET})

const topTenSort = function (a, b) { // sorts games by score, with highest score appearing first. Ties go to game with more secondsLeft
    return (b.score - a.score || b.secondsLeft - a.secondsLeft) 
}

app.get('/', function (req, res) {
    const leaderboardQuery = client.query(
        q.Get(q.Match(q.Index('leaderboard_topTen')))
    )
    leaderboardQuery.then((response) => {
        const topTen = response.data.topTen
        res.json(topTen.sort(topTenSort))
    }).catch((error) => {
        console.log(error)
    })
})

app.get('/country-stats', function (req, res) {
    const countryStatsQuery = client.query(
        q.Get(q.Ref(q.Collection('country-stats'), '285397108568097293'))
    )
    countryStatsQuery.then(response => {
        // const countryCounts = response.data.countryCounts
        // const totalGames = response.data.totalGames
        // Object.keys(countryCounts).map(countryCode => {
        //     return (countryCounts[countryCode] / totalGames * 100).toFixed(3)
        // })
        res.json(response.data)
    }).catch(error => {
        console.log(error)
    })
})

app.post('/', function (req, res) {
    fetch('http://localhost:8000/')
    .then((response) => {
        return response.json()
    })
    .then(topTen => {
        const submittedGame = req.body
        const numGames = topTen.push(submittedGame)
        topTen.sort(topTenSort)
        if (numGames <= 10 || !_.isEqual(topTen.pop(), submittedGame)) { // if the submittedGame becomes part of the new topTen, or there weren't ten games in there
            // update the database
            client.query(
                q.Update(
                    q.Ref(q.Collection('leaderboard'), '283939936047989260'),
                    { data: { topTen: topTen } },
                )
            ).then((response) => {
                console.log(response.data.topTen)
                res.json(topTen.map(game => ({...game, activeGame: _.isEqual(submittedGame, game)})))
            }).catch((error) => {
                console.log(error)
            })
        } else {
            console.log('Doesnt make leaderboard', submittedGame)
            res.json(topTen)
        }
        fetch('http://localhost:8000/country-stats')
        .then(response => {
            return response.json()
        })
        .then(countryStats => {
            console.log(countryStats)
            // above is a placeholder
            // I need to change the way client-side sends game submissions to here
            // Rn, it's {name: xxx, score: xxx, secondsLeft: xxx, (activeGame: x)}
            // Should be {name: xxx, score: xxx, secondsLeft: xxx, countriesNamed (codes): [xxx, xxx, xxx, xxx, ...]}
            // Then, I can loop through countriesNamed and increment their parallels in countryStats
            // Update the document, get the new result back, and send it to the client-side
            // The client-side then takes that object and calculates the percentages, populates a SortableTable, and renders
        })
    })
    .catch((error) => {
        console.log(error)
    })
})

app.listen(8000, ()=> {
    console.log('countries-game api is running on port 8000');
  })
  