require("dotenv").config();
var _ = require("lodash")
var faunadb = require('faunadb'),
q = faunadb.query
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
var cors = require('cors')
const PORT = process.env.PORT || 8000;
const URL = process.env.URL || "https://countries-game-api.herokuapp.com/";

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
        res.json(response.data)
    }).catch(error => {
        console.log(error)
    })
})

app.post('/', function (req, res) {
    fetch(URL)
    .then((response) => {
        return response.json()
    })
    .then(topTen => {
        const submittedGame = req.body
        var topTenResponseArray = topTen;
        const numGames = topTen.push(submittedGame)
        topTen.sort(topTenSort)
        if (!_.isEqual(topTen.pop(), submittedGame) || numGames <= 10 ) { // if the submittedGame becomes part of the new topTen, or there weren't ten games in there
            client.query(
                q.Update(
                    q.Ref(q.Collection('leaderboard'), '283939936047989260'),
                    { data: { topTen: topTen } },
                )
            ).catch((error) => {
                console.log(error)
            })
        }
        return {
            topTen: topTen.map(game => ({...game, activeGame: _.isEqual(submittedGame, game)})), 
            submittedGame: submittedGame
        }
    }).then((results) => {
        const {topTen, submittedGame} = results;
        fetch(URL + 'country-stats')
        .then(response => {
            return response.json()
        })
        .then(countryStats => {
            if (submittedGame.score > 10) {
                _.forEach(submittedGame.namedCountryCodes, code => {
                    countryStats.countryCounts[code] += 1
                })
                countryStats.totalGames += 1
                client.query(
                    q.Update(
                        q.Ref(q.Collection('country-stats'), '285397108568097293'),
                        { data: countryStats },
                    )
                ).then((response) => {
                    res.json({topTen: topTen, ...response.data})
                }).catch((error) => {
                    console.log(error)
                })
            } else {
                res.json({topTen: topTen, ...countryStats})
            }
        })
    })
    
    .catch((error) => {
        console.log(error)
    })
})

app.listen(PORT, ()=> {
    console.log('countries-game api is running on port ' + PORT);
  })
  