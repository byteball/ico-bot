module.exports = {
	rmdir: [ "public" ],

	js: {
		public: {
			build: {
				src: ["src/js/**/*.js","!src/js/libs/**/*.js"],
				dest: "public/assets/js",
				iife: true,
				map: true,
			}
		},
		publicLibs: {
			build: {
				src: "src/js/libs/*.js",
				dest: "public/assets/js/libs"
			}
		}
	},

	pug: {
		public: {
			build: {
				src: [ 'src/views/**/*.pug', '!src/views/hidden/**/*.pug' ],
				dest: 'public'
			},
			watch: {
				src: [ 'src/views/**/*.pug' ]
			}
		},
	},

	stylus: {
		main: {
			build: {
				src: ['src/css/**/*.styl', '!src/css/hidden/**/*.styl' ],
				dest: 'public/assets/css',
			},
			watch: {
				src: ['src/css/**/*.styl']
			}
		},
	},

	components: {
		js: {
			main: {
				src: [
					"src/bower/jquery/dist/jquery.min",
					"src/bower/jquery-animateNumber/jquery.animateNumber.min",
					"src/bower/highcharts/highstock",
					"src/bower/highcharts/modules/exporting",
					"src/bower/moment/min/moment.min",
					"src/bower/bootstrap-datepicker/dist/js/bootstrap-datepicker.min",
				],
				dest: "public/assets/js/libs",
			}
		},
		css: {
			main: {
				src: [
					"src/bower/bootstrap/dist/css/bootstrap.min",
					"src/bower/bootstrap-datepicker/dist/css/bootstrap-datepicker.min",
				],
				dest: "public/assets/css/libs"
			},
			fontAwesome: {
				src: "src/bower/font-awesome/css/font-awesome.min",
				dest: "public/assets/libs/font-awesome/css"
			}
		},
		images: {
			main: {
				src: "src/images/**/*",
				dest: "public/assets/images"
			}
		},
		fonts: {
			fontAwesome: {
				src: [
					"src/bower/font-awesome/fonts/FontAwesome",
					"src/bower/font-awesome/fonts/fontawesome-webfont",
				],
				dest: "public/assets/libs/font-awesome/fonts"
			}
		},
		other: {
			favicon: {
				src: "src/other/favicon.ico",
				dest: "public"
			},
		}
	},

	rename: {
		js: {
			"public/assets/js/libs": [
				{ src: "src/bower/html5-boilerplate/dist/js/vendor/modernizr-3.5.0.min.js", name: "html5-boilerplate-modernizr.min" }
			]
		},
		css: {
			"public/assets/css/libs": [
				{ src: "src/bower/html5-boilerplate/dist/css/normalize.css", name: "html5-boilerplate-normalize" },
				{ src: "src/bower/html5-boilerplate/dist/css/main.css", name: "html5-boilerplate-main" }
			]
		}
	}
};
