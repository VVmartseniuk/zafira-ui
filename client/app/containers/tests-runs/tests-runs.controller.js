'use strict';

const testsRunsController = function testsRunsController($cookieStore, $mdDialog, $timeout, $q, TestRunService,
                                                         UtilService, UserService, testsRunsService, $scope, API_URL,
                                                         $rootScope, $transitions, windowWidthService, TestService,
                                                         toolsService) {
    'ngInject';

    let TENANT;
    const vm = {
        testRuns: [],
        totalResults: 0,
        pageSize: 20,
        currentPage: 1,
        selectedTestRuns: {},
        zafiraWebsocket: null,
        subscriptions: {},
        isMobile: windowWidthService.isMobile,
        isFilterActive: testsRunsService.isFilterActive,
        isSearchActive: testsRunsService.isSearchActive,
        projects: null,
        activeTestRunId: null,

        isTestRunsEmpty: isTestRunsEmpty,
        getTestRuns: getTestRuns,
        areTestRunsFromOneSuite: areTestRunsFromOneSuite,
        showCompareDialog: showCompareDialog,
        batchRerun: batchRerun,
        batchDelete: batchDelete,
        abortSelectedTestRuns: abortSelectedTestRuns,
        batchEmail: batchEmail,
        deleteSingleTestRun: deleteSingleTestRun,
        showCiHelperDialog: showCiHelperDialog,
        resetFilter: resetFilter,
        displaySearch: displaySearch,
        selectAllTestRuns,
        selectTestRun,
        isToolConnected: toolsService.isToolConnected,
    };

    vm.$onInit = init;

    return vm;

    function init() {
        vm.testRuns = vm.resolvedTestRuns.results || [];
        vm.totalResults = vm.resolvedTestRuns.totalResults || 0;
        vm.pageSize = vm.resolvedTestRuns.pageSize;
        vm.currentPage = vm.resolvedTestRuns.page;


        TENANT = $rootScope.globals.auth.tenant;
        loadSlackAvailability();
        readStoredParams();
        initWebsocket();
        bindEvents();
        vm.activeTestRunId && highlightTestRun();
    }

    function resetFilter() {
        $rootScope.$broadcast('tr-filter-reset');
    }

    // function applySearch() {
    //     $rootScope.$broadcast('tr-filter-apply');
    // }

    function highlightTestRun() {
        const activeTestRun = getTestRunById(vm.activeTestRunId);

        if (activeTestRun) {
            $timeout(function() {
                //Scroll to the element if it out of the viewport
                const el = document.getElementById('testRun_' + vm.activeTestRunId);

                //scroll to the element
                if (!isElementInViewport(el)) {
                    const headerOffset = vm.isMobile() && !vm.isSearchActive() ? 144 : 96;
                    const elOffsetTop = $(el).offset().top;

                    $('html,body').animate({ scrollTop: elOffsetTop - headerOffset }, 'slow', function() {
                        activeTestRun.highlighting = true;
                    });
                } else {
                    activeTestRun.highlighting = true;
                }
                $timeout(function() {
                    delete activeTestRun.highlighting;
                }, 4000); //4000 - highlighting animation duration in CSS
            }, 500); // wait for content is rendered (maybe need to be increased if scroll position is incorrect)
        }
    }

    function displaySearch() {
        !vm.isFilterActive() && $rootScope.$broadcast('tr-filter-open-search');
    }

    function readStoredParams() {
        const currentPage = testsRunsService.getSearchParam('page');
        const pageSize = testsRunsService.getSearchParam('pageSize');

        currentPage && (vm.currentPage = currentPage);
        pageSize && (vm.pageSize = pageSize);
    }

    function isTestRunsEmpty() {
        return vm.testRuns && !vm.testRuns.length;
    }

    function getTestRuns(page, pageSize) {
        vm.projects = $cookieStore.get('projects');

        vm.projects && vm.projects.length && testsRunsService.setSearchParam('projects', vm.projects);
        if (page) {
            testsRunsService.setSearchParam('page', page);
            page !== vm.currentPage && (vm.currentPage = page);
        }
        pageSize && testsRunsService.setSearchParam('pageSize', pageSize);
        // vm.selectAll = false;

        return testsRunsService.fetchTestRuns(true)
            .then(function(rs) {
                const testRuns = rs.results;

                vm.totalResults = rs.totalResults;
                vm.pageSize = rs.pageSize;
                vm.testRuns = testRuns;

                return $q.resolve(vm.testRuns);
            })
            .catch(function(err) {
                console.error(err.message);
                alertify.error(err.message);

                return $q.resolve([]);
            });
    }

    function loadSlackAvailability() {
        testsRunsService.fetchSlackAvailability();
    }

    function areTestRunsFromOneSuite() {
        let firstItem;

        // return false if nothing to compare
        if (vm.selectedTestRuns.length <= 1) { return false; }

        firstItem = vm.selectedTestRuns[0];

        return !vm.selectedTestRuns.some(testRun => testRun.testSuite.id !== firstItem.testSuite.id);
    }

    function showCompareDialog(event) {
        $mdDialog.show({
            controller: 'CompareController',
            template: require('../../components/modals/compare/compare.html'),
            parent: angular.element(document.body),
            targetEvent: event,
            clickOutsideToClose:true,
            fullscreen: true,
            locals: {
                selectedTestRuns: vm.selectedTestRuns
            }
        });
    }

    function batchRerun() {
        const rerunFailures = confirm('Would you like to rerun only failures, otherwise all the tests will be restarted?');

        vm.testRuns.forEach(function(testRun) {
            testRun.selected && rebuild(testRun, rerunFailures);
        });
    }

    function rebuild(testRun, rerunFailures) {
        if (vm.isToolConnected('jenkins')) {
            if (!rerunFailures) {
                rerunFailures = confirm('Would you like to rerun only failures, otherwise all the tests will be restarted?');
            }

            TestRunService.rerunTestRun(testRun.id, rerunFailures).then(function(rs) {
                if (rs.success) {
                    testRun.status = 'IN_PROGRESS';
                    alertify.success('Rebuild triggered in CI service');
                } else {
                    alertify.error(rs.message);
                }
            });
        } else {
            window.open(testRun.jenkinsURL + '/rebuild/parameterized', '_blank');
        }
    }

    function batchDelete() {//TODO: why we don't use confirmation in this case?
        const selectedCount = vm.selectedTestRuns.length;
        const promises = vm.selectedTestRuns.map(testRun => deleteTestRunFromQueue(testRun.id));

        $q.all(promises)
            .finally(function() {
                vm.selectedAll = false;
                vm.selectAllTestRuns();
                testsRunsService.clearDataCache();
                //load previous page if was selected all tests and it was a last but not single page
                if (selectedCount === vm.testRuns.length  && vm.currentPage === Math.ceil(vm.totalResults / vm.pageSize) && vm.currentPage !== 1) {
                    getTestRuns(vm.currentPage - 1);
                } else {
                    getTestRuns();
                }
            });
    }

    function abortSelectedTestRuns() {
        if (vm.isToolConnected('jenkins')) {
            vm.selectedTestRuns.forEach(testRun => {
                if (testRun.status === 'IN_PROGRESS') {
                    abort(testRun);
                }
            });
        } else {
            alertify.error('Unable connect to jenkins');
        }
    }

    function abort(testRun) {
        TestRunService.abortCIJob(testRun.id, testRun.ciRunId).then(function (rs) {
            if (rs.success) {
                const abortCause = {};
                const currentUser = UserService.currentUser;

                abortCause.comment = 'Aborted by ' + currentUser.username;
                TestRunService.abortTestRun(testRun.id, testRun.ciRunId, abortCause).then(function(rs) {
                    if (rs.success){
                        testRun.status = 'ABORTED';
                        alertify.success('Testrun ' + testRun.testSuite.name + ' is aborted' );
                    } else {
                        alertify.error(rs.message);
                    }
                });
            }
            else {
                alertify.error(rs.message);
            }
        });
    }

    function batchEmail(event) {
        showEmailDialog(vm.selectedTestRuns, event);
    }

    function showEmailDialog(testRuns, event) {
        $mdDialog.show({
            controller: 'EmailController',
            template: require('../../components/modals/email/email.html'),
            parent: angular.element(document.body),
            targetEvent: event,
            clickOutsideToClose:true,
            fullscreen: true,
            locals: {
                testRuns: testRuns
            }
        });
    }

    function selectTestRun(testRun) {
        if (testRun.selected) {
            if (!vm.testRuns.some(testRun => !testRun.selected)) {
                vm.selectedAll = true;
            }
        } else if (!testRun.selected && vm.selectedAll) {
            vm.selectedAll = false;
        }

        updateSelectedTestRuns();
    }

    function selectAllTestRuns() {
        vm.testRuns.forEach(testRun => testRun.selected = vm.selectedAll);
        updateSelectedTestRuns();
    }

    function updateSelectedTestRuns() {
        vm.selectedTestRuns = vm.testRuns.filter(testRun => testRun.selected);
    }

    function deleteSingleTestRun(testRun) {
        const confirmation = confirm('Do you really want to delete "' + testRun.testSuite.name + '" test run?');

        if (confirmation) {
            const id = testRun.id;
            TestRunService.deleteTestRun(id).then(function(rs) {
                const messageData = rs.success ? {success: rs.success, id: id, message: 'Test run{0} {1} removed'} : {id: id, message: 'Unable to delete test run{0} {1}'};

                UtilService.showDeleteMessage(messageData, [id], [], []);
                if (rs.success) {
                    // deselect any selected testRuns
                    vm.selectedAll = false;
                    vm.selectAllTestRuns();
                    testsRunsService.clearDataCache();
                    //if it was last item on the page try to load previous page
                    if (vm.testRuns.length === 1 && vm.currentPage !== 1) {
                        getTestRuns(vm.currentPage - 1);
                    } else {
                        getTestRuns();
                    }
                }
            });
        }
    }

    function deleteTestRunFromQueue(id) {
        return TestRunService.deleteTestRun(id).then(function(rs) {
            const messageData = rs.success ? {success: rs.success, id: id, message: 'Test run{0} {1} removed'} : {id: id, message: 'Unable to delete test run{0} {1}'};

            UtilService.showDeleteMessage(messageData, [id], [], []);
        });
    }

    function getEventFromMessage(message) {
        return JSON.parse(message.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    }

    function initWebsocket() {
        const wsName = 'zafira';

        vm.zafiraWebsocket = Stomp.over(new SockJS(API_URL + '/api/websockets'));
        vm.zafiraWebsocket.debug = null;
        vm.zafiraWebsocket.connect({withCredentials: false}, function () {
            vm.subscriptions.statistics = subscribeStatisticsTopic();
            vm.subscriptions.testRuns = subscribeTestRunsTopic();
            UtilService.websocketConnected(wsName);
        }, function () {
            UtilService.reconnectWebsocket(wsName, initWebsocket);
        });
    }

    function subscribeTestRunsTopic() {
        return vm.zafiraWebsocket.subscribe('/topic/' + TENANT + '.testRuns', function (data) {
            const event = getEventFromMessage(data.body);
            const testRun = angular.copy(event.testRun);
            const index = getTestRunIndexById(+testRun.id);

            if (vm.projects && vm.projects.length && vm.projects.indexOfField('id', testRun.project.id) === -1) { return; }

            //add new testRun to the top of the list or update fields if it is already in the list
            if (index === -1) {
                // do no add new Test run if Search is active
                if (vm.isSearchActive()) { return; }

                vm.testRuns = testsRunsService.addNewTestRun(testRun);
                vm.totalResults += 1;
            } else {
                const data = {
                    status: testRun.status,
                    reviewed: testRun.reviewed,
                    elapsed: testRun.elapsed,
                    platform: testRun.platform,
                    env: testRun.env,
                    comments: testRun.comments,
                };

                vm.testRuns = testsRunsService.updateTestRun(index, data);
            }
            $scope.$apply();
        });
    }

    function subscribeStatisticsTopic() {
        return vm.zafiraWebsocket.subscribe('/topic/' + TENANT + '.statistics', function (data) {
            const event = getEventFromMessage(data.body);
            const index = getTestRunIndexById(+event.testRunStatistics.testRunId);

            if (index !== -1) {
                const data = {
                    inProgress: event.testRunStatistics.inProgress,
                    passed: event.testRunStatistics.passed,
                    failed: event.testRunStatistics.failed,
                    failedAsKnown: event.testRunStatistics.failedAsKnown,
                    failedAsBlocker: event.testRunStatistics.failedAsBlocker,
                    skipped: event.testRunStatistics.skipped,
                    reviewed: event.testRunStatistics.reviewed,
                    aborted: event.testRunStatistics.aborted,
                    queued: event.testRunStatistics.queued,
                };

                vm.testRuns = testsRunsService.updateTestRun(index, data);
                $scope.$apply();
            }


        });
    }

    function bindEvents() {
        $scope.$on('$destroy', function () {
            if(vm.zafiraWebsocket && vm.zafiraWebsocket.connected) {
                vm.subscriptions.statistics && vm.subscriptions.statistics.unsubscribe();
                vm.subscriptions.testRuns && vm.subscriptions.testRuns.unsubscribe();
                vm.zafiraWebsocket.disconnect();
                UtilService.websocketConnected('zafira');
            }
        });

        const onTransStartSubscription = $transitions.onStart({}, function(trans) {
            const toState = trans.to();

            if (toState.name !== 'tests.runDetails'){
                TestService.clearDataCache();
            }
            onTransStartSubscription();
        });
    }

    function showCiHelperDialog(event) {
        $mdDialog.show({
            controller: CiHelperController,
            template: CiHelperTemplate,
            parent: angular.element(document.body),
            targetEvent: event,
            clickOutsideToClose:false,
            fullscreen: true,
            autoWrap: false
        });
    }

    function getTestRunIndexById(id) {
        let index = -1;

        vm.testRuns.some(function(testRun, i) {
            return testRun.id === id && (index = i) && true;
        });

        return index;
    }

    function getTestRunById(id) {
        let testRun;
        const index = getTestRunIndexById(id);

        index !== -1 && (testRun = vm.testRuns[index]);

        return testRun;
    }

    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();

        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

export default testsRunsController;
