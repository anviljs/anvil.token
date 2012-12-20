/*
	anvil.token - A core anvil extension that provides token replacement in source files
	version:	0.1.0
	author:		Alex Robson <alex@sharplearningcurve.com> (http://sharplearningcurve.com)
	copyright:	2011 - 2012
	license:	Dual licensed
				MIT (http://www.opensource.org/licenses/mit-license)
				GPL (http://www.opensource.org/licenses/gpl-license)
*/
var yaml;

module.exports = function( _, anvil ) {
	return anvil.plugin( {
		name: "anvil.token",
		activity: "pre-process",
		commander: [
			[ "--values [value]", "a key / value JSON or YAML file to use with token replacement" ]
		],
		config: {
			tokens: [
				{
					find: "/[{]{3}([^}]*)[}]{3}/g",
					replace: "/[{]{3}replace[}]{3}/g"
				}
			],
			packageData: {},
			sourceData: {}
		},

		configure: function( config, command, done ) {
			var self = this;
			this.loadPackage( function() {
				var valuesPath = command.values || self.config.values;
				if( valuesPath ) {
					self.loadValues( valuesPath, done );
				} else {
					self.config.sourceData = self.config.packageData;
					done();
				}
			} );
		},

		loadPackage: function( done ) {
			var self = this;
			anvil.fs.read( "./package.json", function( content, error ) {
				if( !error ) {
					self.config.packageData = JSON.safeParse( content );
				}
				done();
			} );
		},

		loadValues: function( path, done ) {
			if( !yaml ) {
				yaml = require( "yaml-js" );
			}
			var self = this;
			var parse = path.indexOf( "yaml" ) > 0 ?
				function( data ) { return yaml.load( data ); } :
				function( data ) { return JSON.safeParse( data ); };

			anvil.fs.read( path, function( content, error ) {
				if( !error ) {
					var values = parse( content );
					self.config.sourceData = _.extend( self.config.packageData, values );
				} else {
					self.config.sourceData = self.config.packageData;
				}
				done();
			} );
		},

		run: function( done ) {
			anvil.scheduler.parallel( anvil.project.files, this.replaceTokens, function() { done(); } );
		},

		replaceTokens: function( file, done ) {
			var self = this;
			var pluginConfig = anvil.config[ this.name ],
						tokens = pluginConfig ? pluginConfig.tokens : [];
			if( tokens.length === 0 ) {
				done();
			}

			anvil.fs.read( [ file.workingPath, file.name ], function( content, error ) {
				if( !error ) {
					
					_.each( tokens, function( token ) {
						var tokens = [],
							finder = anvil.utility.parseRegex( token.find ),
							match, tokenName;
						while( ( match = finder.exec( content ) ) ) {
							tokenName = match[1];
							tokens.push( tokenName );
						}
						if( tokens.length > 0 ) {
							var hadReplacement = false;
							_.each( tokens, function( tokenName ) {
								var replacement = self.config.sourceData[ tokenName ],
									stringified, trimmed, replacer;
								if( replacement ) {
									hadReplacement = true;
									stringified = ( token.replace ).replace( /replace/, tokenName );
									replacer = anvil.utility.parseRegex( stringified );
									content = content.replace( replacer, replacement );
								}
							} );
							if( hadReplacement ) {
								anvil.fs.write( [ file.workingPath, file.name ], content, done );
							} else {
								done();
							}
						} else {
							done();
						}
					} );
				} else {
					done();
				}
			} );
		}
	} );
};