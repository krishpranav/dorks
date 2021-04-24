var fs = require('fs')
var system = require('system')
var pages = []
var userAgents = [
	"Mozilla/5.0 (X11; Linux i686; rv:40.0) Gecko/20100101 Firefox/40.0",
	"Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16",
	"Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 6.2) AppleWebKit/535.7 (KHTML, like Gecko) Comodo_Dragon/16.1.1.0 Chrome/16.0.912.63 Safari/535.7",
	"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)"
]

function Google( site )
{
	var web_browser = require('webpage').create()
	var uri = 'http://www.google.com/'
	var dorks = []
	var query = ( site.trim() != '' ) ? 'site:' + site : ''
	var found_pages = 0
	var timeout = 0
	var captcha_retry_timeout = 0
	this.done = false
	web_browser.viewportSize = { width: 1280, height: 800 }
	web_browser.settings.userAgent = userAgents[ parseInt( Math.random() * userAgents.length ) ]
	web_browser.__this = this

	web_browser.onConsoleMessage = function(msg)
	{
		console.log(msg)
	}

	this.set_timeout = function( ms )
	{
		timeout = ms
		return this
	}

	this.set_captcha_retry_timeout = function( ms )
	{
		captcha_retry_timeout = ms
		return this
	}

	this.set_dork = function( dork )
	{
		dorks = dorks.concat( dork )
		return this
	}

	this.set_dorks = function( dorks_file )
	{
		dorks = dorks.concat( fs.isFile(dorks_file) ? fs.read(dorks_file).replace(/\r/g, '').split('\n').reverse().filter( function(a) { return a } ) : [] )
		return this
	}

	var save_state = function( session_file, state )
	{
		fs.write( session_file, JSON.stringify( state ), 'w' )
	}

	var load_state = function( session_file )
	{
		if( fs.isFile(session_file) )
		{
			console.log("resume " + session_file)
			return JSON.parse( fs.read(session_file) )
		}
	}

	this.filter = function( filter )
	{
		query += ' ' + filter
		return this
	}

	this.attack = function( out_file )
	{
		var session_file = ( ( site.trim() ) ? '__' + site.trim().replace(/[\.:\/]/g, '_') : '__state' ) + '.json'
		var dork, captcha = false
		dorks = load_state( session_file ) || dorks

		web_browser.onResourceReceived = function(resp) { if(! captcha) captcha = (resp.status == 403) }
		web_browser.onLoadFinished = function(status)
		{
			web_browser.render( ( ( site.trim() ) ? site.trim().replace(/\./g, '_') : 'page' ) + '.png' )
			if(! captcha)
				captcha = web_browser.evaluate( function() { if(document.getElementById('captcha')) return true } )

			if( /q=/.test(web_browser.url) && !captcha )
			{
				var result = web_browser.evaluateJavaScript(
					"function() {\n\
						var href_results = [], a = document.getElementsByTagName('a'), match\n\
						for( var i = 0; i < a.length; i++ )\n\
		  					if( /*a[i].getAttribute('target') == '_blank' &&*/ a[i].parentNode.tagName.toLowerCase() == 'h3' && a[i].getAttribute('href').indexOf('" + ( (site.trim()) ? site.trim().replace(/'/g, '') : '') + "') != -1 )\n\
		  					{\n\
		  						if( 0 /*( match = a[i].getAttribute('href').match(/q=(.*)/) ) && match.length == 2 && ( uri = match[1] )*/ )\n\
		  						{\n\
		  							console.log( '+ ' + uri )\n\
		    						href_results.push( uri )\n\
		    					}\n\
		    					else\n\
		    					{\n\
		    						console.log( '+ ' + a[i].getAttribute('href') )\n\
		    						href_results.push( a[i].getAttribute('href') )\n\
		    					}\n\
		    				}\n\
	    				return href_results\n\
					}"
				)
				if(result.length)
				{
					//web_browser.render( ( (site.trim()) ? site.trim().replace(/\./g, '_') : 'page' ) + '_' + (++found_pages) + '.png')
					if( out_file )
						fs.write( out_file, query + ' ' + dork + '\n', 'a' )
				}
			}

			save_state( session_file, dorks )

			if(captcha)
			{
				if( dorks.indexOf(dork) == -1 )
					dorks.splice( dorks.length, 0, dork )
				if( captcha_retry_timeout )	/* easy anti-captcha */
				{
					console.log("warn: captcha, sleeping " + captcha_retry_timeout + " ms")
					setTimeout( function() { 
						web_browser.open( uri, function(status) { console.log("reopen " + uri + " (another UserAgent)") } )
					}, captcha_retry_timeout )
					web_browser.settings.userAgent = userAgents[ parseInt( Math.random() * userAgents.length ) ]
				}
				else
				{
					var intr = setInterval( function() {
						if(! fs.isFile('captcha.png') )
						{
							web_browser.render('captcha.png')
							console.log('warn: enter chars from captcha.png')
						}
						if( captcha = system.stdin.readLine().trim() )
						{
							fs.remove('captcha.png')
							var error = web_browser.evaluateJavaScript(
								"function() {\n\
									var captcha = document.getElementById('captcha')\n\
									if(! captcha)\n\
										return 'captcha field not found'\n\
									captcha.value = '" + captcha.replace(/[\r\n]/g, '') + "'\n\
									node = captcha\n\
									while( node = node.parentNode )\n\
										if( node.tagName.toLowerCase() == 'form' || node.tagName.toLowerCase() == 'body' )\n\
				    						break\n\
				    				if( node.tagName.toLowerCase() != 'form')\n\
				    					return 'captcha form not found'\n\
				    			}"
							)
							web_browser.sendEvent('keypress', web_browser.event.key.Enter)
							captcha = false
							clearInterval(intr)
							if(error)
								console.log(error)
						}
						else
							console.log('warn: enter chars from captcha.png')
					}, 500 )
				}
			}
			else
			{
				if( dork = dorks.pop() )
				{
					console.log("dork: " + dork)
					var error = web_browser.evaluateJavaScript(
						"function() {\n\
							setTimeout( function() {\n\
								var search_query, inp = document.getElementsByTagName('input')\n\
								for(var i = 0; i<inp.length; i++)\n\
								{\n\
				  					if( inp[i].getAttribute('type') == 'text' || inp[i].getAttribute('type') == null )\n\
				  					{\n\
				  						search_query = inp[i]\n\
				  						break\n\
				  					}\n\
				  				}\n\
				  				if(! search_query)\n\
				  					return 'search query input not found'\n\
				  				search_query.value = '" + query.replace(/'/g, "\\'").replace(/\r/g, '') + " " + dork.replace(/'/g, "\\'").replace(/\r/g, '') + "'\n\
				  				node = search_query\n\
								while( node = node.parentNode )\n\
						  			if( node.tagName.toLowerCase() == 'form' || node.tagName.toLowerCase() == 'body' )\n\
				    					break\n\
				    			if(! node.tagName.toLowerCase() == 'form')\n\
				    				return 'search form not found'\n\
								node.submit()\n\
							}, " + timeout + ")\n\
						}"
					)
					if(error)
					{
						dorks.splice( dorks.length, 0, dork )
						console.log('err: ' + error)
					}
				}
				else
				{
					fs.remove( session_file )
					web_browser.__this.done = true
					exit()
				}
			}
		}

		web_browser.open( uri, function(status) {
			if(status != 'success')
				console.log( 'warn: ' + uri + ': ' + status)
		} )
		return this
	}
}

function GHDB()
{
    var web_browser = require('webpage').create()
    var uri ='https://www.exploit-db.com/google-hacking-database/'
    var dorks = []
    var filename = ''
    var dork_descriptions = []
    var need_to_extract_dorks = false
    this.done = false
    web_browser.viewportSize = { width: 1280, height: 800 }
    web_browser.__this = this

    web_browser.onConsoleMessage = function(msg)
    {
        console.log(msg)
    }

    this.save = function(result_filename)
    {
        filename = result_filename
        return this
    }
}