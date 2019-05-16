'use strict';

import uploadImageModalController from '../shared/modals/upload-image-modal/upload-image-modal.controller';
import uploadImageModalTemplate from '../shared/modals/upload-image-modal/upload-image-modal.html';

const UserProfileController = function UserProfileController($mdDialog, UserService, DashboardService, UtilService,
                                                             AuthService, appConfig, $q, $state, messageService) {
    'ngInject';

    const vm = {
        main: appConfig.main,
        user: {},
        changePassword: {},
        preferences: [],
        preferenceForm: {},
        dashboards: [],
        pefrDashboardId: null,
        accessToken: null,
        widgetRefreshIntervals: [0, 30000, 60000, 120000, 300000],

        copyAccessToken,
        deleteUserProfilePhoto,
        isIntervalSelected,
        isDashboardSelected,
        showUploadImageDialog,
        updateUserProfile,
        updateUserPreferences,
        resetPreferences,
        convertMillis,
        updateUserPassword,
        generateAccessToken,
        validations: UtilService.validations,
        untouchForm: UtilService.untouchForm,
        goToState,

        get currentUser() { return UserService.currentUser; },
    };

    function goToState(state) {
        $state.go(state);
    }

    function isIntervalSelected(interval) {
        return vm.currentUser && vm.currentUser.refreshInterval === interval;
    }

    function deleteUserProfilePhoto() {
        UserService.deleteUserProfilePhoto().then(function (rs) {
            if (rs.success) {
                vm.currentUser.photoURL = '';
                messageService.success('Photo was deleted');
            }
            else {
                messageService.error(rs.message);
            }
        });
    }

    function canSeeHiddenDashboards() {
        return AuthService.UserHasAnyPermission(['VIEW_HIDDEN_DASHBOARDS']);
    }

    function updateUserProfile() {
        const profile = angular.copy(vm.user);

        delete profile.preferences;
        UserService.updateUserProfile(profile)
            .then(function (rs) {
                if (rs.success) {
                    vm.user = rs.data;
                    UserService.currentUser = Object.assign({}, vm.currentUser, vm.user);
                    messageService.success('User profile updated');
                } else {
                    messageService.error(rs.message);
                }
            });
    }

    function generateAccessToken() {
        AuthService.GenerateAccessToken()
            .then(function (rs) {
                if (rs.success) {
                    vm.accessToken = rs.data.token;
                }
            });
    }

    function copyAccessToken() {
        var node = document.createElement('pre');

        node.textContent = vm.accessToken;
        document.body.appendChild(node);

        var selection = window.getSelection();
        selection.removeAllRanges();

        var range = document.createRange();
        range.selectNodeContents(node);
        selection.addRange(range);

        document.execCommand('copy');
        selection.removeAllRanges();
        document.body.removeChild(node);

        messageService.success('Access token copied to clipboard');
    }

    function fetchDashboards() {
        DashboardService.GetDashboards(canSeeHiddenDashboards()).then(function (rs) {
            if (rs.success) {
                vm.dashboards = rs.data;
            }
        });
    }

    function updateUserPassword() {
        const data = angular.copy(vm.changePassword);

        data.userId = vm.user.id;
        UserService.updateUserPassword(data)
            .then(function (rs) {
                if (rs.success) {
                    vm.changePassword = {};
                    messageService.success('Password changed');
                } else {
                    messageService.error(rs.message);
                }
            });
    }

    function fetchUserProfile() {
        UserService.getUserProfile()
            .then(function (rs) {
                if (rs.success) {
                    vm.user = rs.data;
                    vm.changePassword.userId = vm.user.id;
                    if (vm.user.preferences.length) {
                        vm.preferences = vm.user.preferences;
                    } else {
                        fetchDefaultPreferences();
                    }
                } else {
                    messageService.error(rs.message);
                }
            });
    }

    function fetchDefaultPreferences() {
        UserService.getDefaultPreferences().then(function (rs) {
            if (rs.success) {
                    vm.preferences = rs.data;
                } else {
                    messageService.error(rs.message);
                }
            });
    }

    function updateUserPreferences(preferenceForm) {
        const preferences = angular.copy(vm.preferences);

        for (var i = 0; i < preferences.length; i++) {
            preferences[i].userId = vm.user.id;
            if (preferences[i].name === 'DEFAULT_DASHBOARD') {
                preferences[i].value = preferenceForm.defaultDashboard;
            } else if (preferences[i].name === 'REFRESH_INTERVAL') {
                preferences[i].value = parseInt(preferenceForm.refreshInterval, 10);
            } else if (preferences[i].name === 'THEME') {
                preferences[i].value = vm.main.skin;
            }
        }
        UserService.updateUserPreferences(vm.user.id, preferences).then(function (rs) {
            if (rs.success) {
                vm.preferences = rs.data;
                if (rs.data && rs.data.length) {
                    UserService.setDefaultPreferences(rs.data);
                }
                messageService.success('User preferences are successfully updated');
            }
            else {
                messageService.error(rs.message);
            }
        });
    }

    function resetPreferences(preferenceForm) {
        UserService.resetUserPreferencesToDefault().then(function (rs) {
            if (rs.success) {
                vm.preferences = rs.data;
                UserService.setDefaultPreferences(vm.preferences);
                preferenceForm.refreshInterval = vm.currentUser.refreshInterval;
                preferenceForm.defaultDashboard = vm.currentUser.defaultDashboard;
                vm.main.skin = vm.currentUser.theme;
                messageService.success('Preferences are set to default');
            }
            else {
                messageService.error(rs.message);
            }
        });
    }

    function isDashboardSelected(dashboard) {
        return vm.currentUser && vm.currentUser.defaultDashboard === dashboard.title;
    }

    function convertMillis(millis) {
        const sec = millis / 1000;

        if (millis === 0) {
            return 'Disabled'
        } else if (sec < 60) {
            return sec + ' sec';
        } else {
            return sec / 60 + ' min';
        }
    }

    function showUploadImageDialog($event) {
        $mdDialog.show({
            controller: uploadImageModalController,
            controllerAs: '$ctrl',
            template: uploadImageModalTemplate,
            parent: angular.element(document.body),
            targetEvent: $event,
            clickOutsideToClose: true,
            locals: {
                urlHandler: (url) => {
                    if (url) {
                        const profile = angular.copy(vm.user);

                        profile.photoURL = url;
                        delete profile.preferences;
                        return UserService.updateUserProfile(profile).then((prs) => {
                            if (prs.success) {
                                vm.currentUser.photoURL = `${url}?${(new Date()).getTime()}`;
                                messageService.success('Profile was successfully updated');

                                return true;
                            } else {
                                messageService.error(prs.message);

                                return false;
                            }
                        });
                    }

                    return $q.reject(false);
                },
                fileTypes: 'USERS',
            }
        });
    }

    function initController() {
        fetchDashboards();
        fetchUserProfile();
    }

    vm.$onInit = initController;

    return vm;
};

export default UserProfileController;
