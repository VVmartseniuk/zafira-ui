(function () {
    'use strict';

    angular.module('app')
        .controller('AppCtrl', AppCtrl); // overall control
	    function AppCtrl($scope, $rootScope, $templateCache, $state, httpBuffer, $window, $cookies, $q, appConfig,
                         AuthService, UserService, SettingsService, ConfigService, AuthIntercepter, UtilService,
                         SettingProvider, $timeout, toolsService, UI_VERSION) {
            'ngInject';

	        $scope.pageTransitionOpts = appConfig.pageTransitionOpts;
	        $scope.main = appConfig.main;
	        $scope.color = appConfig.color;
	        $rootScope.darkThemes = ['11', '21', '31', '22'];
	        $rootScope.currentOffset = 0;
            $rootScope.companyLogo = {
                name: 'COMPANY_LOGO_URL',
                value: SettingProvider.getCompanyLogoURl() || ''
            };

            var UNANIMATED_STATES = ['signin', 'signup', 'forgotPassword', 'resetPassword'];

            $scope.isAnimated = function() {
                return UNANIMATED_STATES.indexOf($state.current.name) == -1;
            };

            $scope.setOffset = function (event) {
	              $rootScope.currentOffset = 0;
	              var bottomHeight = $window.innerHeight - event.target.clientHeight - event.clientY;
	              if(bottomHeight < 400) {
	                  $rootScope.currentOffset = -250 + bottomHeight;
	              }
            };

	        $scope.initSession = toolsService.getTools;

	        $rootScope.$on("event:auth-loginSuccess", function(ev, payload){
                AuthService.SetCredentials(payload.auth);
                $scope.initSession();
                UserService.initCurrentUser()
                    .then(function(user) {
                        var bufferedRequests = httpBuffer.getBuffer();

                        $scope.main.skin = user.theme;
                        if (bufferedRequests && bufferedRequests.length) {
                            $window.location.href = bufferedRequests[0].location;
                        } else {
                            if (payload.referrer) {
                                var params = payload.referrerParams ? payload.referrerParams : {};

                                $timeout(() => {
                                    $state.go(payload.referrer, params);
                                });
                            } else {
                                $timeout(() => {
                                    $state.go('dashboard.page', {dashboardId: user.defaultDashboardId});
                                });
                            }
                        }
                    }, function() {});
	        });

            $rootScope.$on('event:auth-loginRequired', function() {
		        	if ($rootScope.globals.auth && $rootScope.globals.auth.refreshToken) {
	                    AuthService.RefreshToken($rootScope.globals.auth.refreshToken)
	                        .then(function (rs) {
	                            if (rs.success) {
	                                AuthService.SetCredentials(rs.data);
	                                AuthIntercepter.loginConfirmed();
	                            } else if ($state.current.name !== 'signup') {
	                                AuthIntercepter.loginCancelled();
	                                AuthService.ClearCredentials();
                                    $state.go("signin", {referrer: $state.current.name, referrerParams: $state.current.params});
	                            }
	                        });
		        	} else if ($state.current.name !== 'signup') {
	                    $state.go('signin', {referrer: $state.current.name, referrerParams: $state.current.params});
		        	}
	        });

            function getVersion() {
                return $q(function (resolve, reject) {
                    ConfigService.getConfig("version").then(function(rs) {
                        if(rs.success)
                        {
                            $rootScope.version = rs.data;
                            $rootScope.version.ui = UI_VERSION;

                            resolve(rs.data);
                        } else {
                            reject(rs.message);
                        }
                    });
                });
            };

            function clearCache(version) {
                var v = $cookies.get('version');
                if(v !== version) {
                    $cookies.put('version', version);
                    $templateCache.removeAll();
                }
            };

	        (function initController() {
                SettingsService.getCompanyLogo()
                    .then(function(rs) {
                        if (rs.success) {
                            if (!$rootScope.companyLogo.value || $rootScope.companyLogo.value !== rs.data) {
                                $rootScope.companyLogo.value = rs.data.value;
                                $rootScope.companyLogo.id = rs.data.id;
                                SettingProvider.setCompanyLogoURL($rootScope.companyLogo.value);
                            }
                        }
                    });
                $rootScope.globals = $rootScope.globals && $rootScope.globals.auth ? $rootScope.globals : $cookies.getObject('globals') || {};
	            if ($rootScope.globals.auth) {
                    var currentUser;

                    $scope.initSession();

                    currentUser = UserService.currentUser;
                    if (!currentUser) {
                        UserService.initCurrentUser()
                            .then(function (user) {
                                $scope.main.skin = user.theme;
                            }, function() {});
                    } else {
                        $scope.main.skin = currentUser.theme;
                    }
	            }
                 getVersion();
	        })();
	    }
})();
