'use strict';

const dashboardEmailModalController = function dashboardEmailModalController($q, $screenshot, $mdDialog, $mdConstant, DashboardService, UserService, model, messageService, UtilService) {
    'ngInject';

    const vm = {
        cancel,
        UtilService,
        users: [],
        querySearch,
        sendEmail,
        keys: [$mdConstant.KEY_CODE.ENTER, $mdConstant.KEY_CODE.TAB, $mdConstant.KEY_CODE.COMMA, $mdConstant.KEY_CODE.SEMICOLON, $mdConstant.KEY_CODE.SPACE],
        email: {
            subject: model.title,
            text: "This is auto-generated email, please do not reply!",
            hostname: document.location.hostname,
            urls: [document.location.href],
            recipients: []
        }
    }
    let stopCriteria = '########';
    let usersSearchCriteria = {};

    function sendEmail() {
       let email = angular.copy(vm.email);

       email.recipients =  email.recipients.toString();
       
        return $screenshot.take(model.locator).then(function (multipart) {
            return DashboardService.SendDashboardByEmail(multipart, email).then(function (rs) {
                if (rs.success) {
                    messageService.success('Email was successfully sent!');
                    hide();
                }
                else {
                    messageService.error(rs.message);
                }
            });
        });
    };

    function querySearch(criteria, alreadyAddedUsers) {
        usersSearchCriteria.query = criteria;
        if (!criteria.includes(stopCriteria)) {
            stopCriteria = '########';

            return UserService.searchUsersWithQuery(usersSearchCriteria, criteria).then(function (rs) {
                if (rs.success) {
                    if (!rs.data.results.length) {
                        stopCriteria = criteria;
                    }

                    return UtilService.filterUsersForSend(rs.data.results, alreadyAddedUsers);
                }
            });
        }

        return "";
    }

    function hide() {
        $mdDialog.hide();
    };
    function cancel() {
        $mdDialog.cancel();
    };

    return vm;
};

export default dashboardEmailModalController;
