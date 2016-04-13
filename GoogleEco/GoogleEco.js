var ScribeSpeak;
var token;
var TIME_ELAPSED;
var FULL_RECO;
var PARTIAL_RECO;
var TIMEOUT_SEC = 10000;

exports.init = function () {
    info('[ GoogleEco ] is initializing ...');
}

exports.action = function(data, callback){
	
	ScribeSpeak = SARAH.ScribeSpeak;

	FULL_RECO = SARAH.context.scribe.FULL_RECO;
	PARTIAL_RECO = SARAH.context.scribe.PARTIAL_RECO;
	TIME_ELAPSED = SARAH.context.scribe.TIME_ELAPSED;

	SARAH.context.scribe.activePlugin('GoogleEco');

	var util = require('util');
	console.log("GoogleEco call log: " + util.inspect(data, { showHidden: true, depth: null }));

	SARAH.context.scribe.hook = function(event) {
		checkScribe(event, data.action, callback, data); 
	};
	
	token = setTimeout(function(){
		SARAH.context.scribe.hook("TIME_ELAPSED");
	}, TIMEOUT_SEC);

}

function checkScribe(event, action, callback, data) {

	if (event == FULL_RECO) {
		clearTimeout(token);
		SARAH.context.scribe.hook = undefined;
		// aurait-on trouvé ?
		decodeScribe(SARAH.context.scribe.lastReco, callback, data);

	} else if(event == TIME_ELAPSED) {
		// timeout !
		SARAH.context.scribe.hook = undefined;
		// aurait-on compris autre chose ?
		if (SARAH.context.scribe.lastPartialConfidence >= 0.7 && SARAH.context.scribe.compteurPartial > SARAH.context.scribe.compteur) {
			decodeScribe(SARAH.context.scribe.lastPartial, callback, data);
		} else {
			SARAH.context.scribe.activePlugin('Aucun (GoogleEco)');
			//ScribeSpeak("Désolé je n'ai pas compris. Merci de réessayer.", true);
			return callback({ 'tts': "Désolé je n'ai pas compris. Merci de réessayer." });
		}
		
	} else {
		// pas traité
	}
}

function decodeScribe(search, callback, data) {

	console.log ("Search: " + search);
	if(!data.where || data.where != "world") {
		var rgxp = / (en|aux|au|de la|des) (.+)/i;
		
		var match = search.match(rgxp);
		if (!match || match.length <= 1){
			SARAH.context.scribe.activePlugin('Aucun (GoogleEco)');
			//ScribeSpeak("Désolé je n'ai pas compris.", true);
			return callback({ 'tts': "Désolé je n'ai pas compris" });
		}

		return ecogoogle(match, callback, data);
	} else {
		return population_mondiale(callback);
	}
}

function ecogoogle(match, callback, data) {

	var pays = match[2].trim();
	var deter = match[1].trim();
	var search = data.what + " " + deter + " " + pays;

	var fs = require("fs");
	var path = require('path');
 	var filePath = __dirname + "/SaveInfosEco.json";
	var file_content;

	file_content = fs.readFileSync(filePath, 'utf8');
	file_content = JSON.parse(file_content);

	if(typeof file_content[search] != 'undefined' && file_content[search] != "") {
		var infos = file_content[search];
		console.log("Informations: " + infos);
		//ScribeSpeak(infos);
		callback({ 'tts': infos});
		return;

	} else {

		var url = "https://www.google.fr/search?q=" + encodeURI(search) + "&btnG=Rechercher&gbv=1";
		console.log('Url Request: ' + url);

		var request = require('request');
		var cheerio = require('cheerio');

		var options = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36',
			'Accept-Charset': 'utf-8'
		};
		
		request({ 'uri': url, 'headers': options }, function(error, response, html) {

	    	if (error || response.statusCode != 200) {
				//ScribeSpeak("La requête vers Google a échoué. Erreur " + response.statusCode);
				callback({ 'tts': "La requête vers Google a échoué. Erreur " + response.statusCode});
				return;
		    }
	        var $ = cheerio.load(html);

	        var infos = $('#search #ires .g #_vBb span._m3b').text().trim();
	        var desc = $('#search #ires .g #_vBb div._eGc').text().trim();

	        var resultat = desc + ". " + infos;

	        if(resultat == "") {
	        	console.log("Impossible de récupérer les informations sur Google");
	        	//ScribeSpeak("Désolé, je n'ai pas réussi à récupérer d'informations", true);
	        	callback({ 'tts': "Désolé, je n'ai pas réussi à récupérer d'informations" });
	        } else {
	        	var resultat = resultat.replace('billion', 'milliard').replace('billions', 'milliards').replace('USD', 'de dollars').replace('%', 'pourcent').replace('(', 'en ').replace(')', '');

	        	file_content[search] = resultat;
	        	chaine = JSON.stringify(file_content, null, '\t');
				fs.writeFile(filePath, chaine, function (err) {
					console.log("[ GoogleEco ] Informations enregistrés");
				});

	        	console.log("Informations: " + resultat);
	        	//ScribeSpeak(resultat);
	        	callback({ 'tts': resultat });
	        }
		    return;
	    });
	}
}

function population_mondiale(callback) {
	// On ne stock pas car ce chiffre évolue vite
	var url = "http://www.populationmondiale.com/population/clock.php?lang=fr&aff=0&size=30&cpop=C0C0C0&cclock=CC0000";
	console.log('Url Request: ' + url);

	var request = require('request');
	var cheerio = require('cheerio');

	var options = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36',
		'Accept-Charset': 'utf-8'
	};
		
	request({ 'uri': url, 'headers': options }, function(error, response, html) {

    	if (error || response.statusCode != 200) {
			//ScribeSpeak("La requête a échoué. Erreur " + response.statusCode);
			callback({ 'tts': "La requête a échoué. Erreur " + response.statusCode });
			return;
	    }
        var $ = cheerio.load(html);

        var population = $('a.clock').text().trim();

        if(population == "") {
        	console.log("Impossible de récupérer les informations");
        	//ScribeSpeak("Désolé, je n'ai pas réussi à récupérer d'informations", true);
        	callback({ 'tts': "Désolé, je n'ai pas réussi à récupérer d'informations" });
        } else {
        	console.log("Informations: " + population);
        	//ScribeSpeak("Actuellement il y a " + population + " sur la planète");
        	callback({ 'tts': "Actuellement il y a " + population + " sur la planète" });
        }
	    return;
    });
}