<?php
/*
 * Zentraler API-Router
 * @author    M.Andreas
 * @date      02/2026
 */

require __DIR__ . '/../bootstrap.php';

use Src\Controller\ApiController;
use Src\Controller\AuthController;
use Src\Controller\KTController;
use Src\Controller\LeagueController;
use Src\Controller\StatsController;
use Src\Controller\AdminController;
use Src\Controller\ScheduleController;
use Src\Controller\ReminderController;

header("Content-Type: application/json; charset=UTF-8");

$api = new ApiController($dbConnector);

if (!$api->prepareRequest(false)) {
    exit;
}

// Route-Tabelle: [Controller-Klasse, Methode, Auth erforderlich]
$routes = [
    // Auth (kein Login erforderlich)
    'login'              => [AuthController::class, 'login', false],
    'logout'             => [AuthController::class, 'logout', false],
    'checkLogin'         => [AuthController::class, 'checkLogin', false],

    // Auswahllisten
    'getTrList'          => [KTController::class, 'getTrList', true],
    'getMdList'          => [KTController::class, 'getMdList', true],
    'getMenu'            => [KTController::class, 'getMenu', true],

    // Tipps
    'getTipOverview'     => [KTController::class, 'getTipOverview', true],
    'getTipEdit'         => [KTController::class, 'getTipEdit', true],
    'saveTips'           => [KTController::class, 'saveTips', true],
    'getStandings'       => [KTController::class, 'getStandings', true],

    // Liga
    'getLeagueSchedule'  => [LeagueController::class, 'getSchedule', true],
    'getLeagueTable'     => [LeagueController::class, 'getTable', true],
    'getLeagueTableAll'  => [LeagueController::class, 'getAllTimeTable', true],

    // Praemien
    'getPrizeOverview'   => [KTController::class, 'getPrizeOverview', true],
    'getPrizeInfo'       => [KTController::class, 'getPrizeInfo', true],

    // Spielplan / Tabelle
    'getMatchSchedule'   => [ScheduleController::class, 'getSchedule', true],
    'getBundesligaTable' => [ScheduleController::class, 'getTable', true],

    // Statistiken
    'getStatTipFrequency'  => [StatsController::class, 'getTipFrequency', true],
    'getStatPlace'         => [StatsController::class, 'getPlaceHistory', true],
    'getStatPlaceLeague'   => [StatsController::class, 'getPlaceHistoryLeague', true],
    'getStatAllTime'       => [StatsController::class, 'getAllTimeStandings', true],
    'getTipTable'          => [StatsController::class, 'getTipTable', true],

    // Admin
    'getUsers'             => [AdminController::class, 'getUsers', true],
    'saveUser'             => [AdminController::class, 'saveUser', true],
    'getAdminTips'         => [AdminController::class, 'getAdminTips', true],
    'saveAdminTips'        => [AdminController::class, 'saveAdminTips', true],
    'getRounds'            => [AdminController::class, 'getRounds', true],
    'saveRound'            => [AdminController::class, 'saveRound', true],
    'getLeagueMembers'     => [AdminController::class, 'getLeagueMembers', true],
    'saveLeagueMembers'    => [AdminController::class, 'saveLeagueMembers', true],
    'createLeagueSchedule' => [AdminController::class, 'createLeagueSchedule', true],
    'savePrizes'           => [AdminController::class, 'savePrizes', true],
    'saveSchedule'         => [AdminController::class, 'saveSchedule', true],
    'importResults'        => [AdminController::class, 'importResults', true],
    'importSchedule'       => [AdminController::class, 'importSchedule', true],

    // Reminder
    'sendReminders'        => [ReminderController::class, 'send', true],
];

$method = $api->method;

if (!isset($routes[$method])) {
    $api->RespondNotFound();
    exit;
}

[$controllerClass, $action, $requiresAuth] = $routes[$method];

if ($requiresAuth && !$api->user) {
    $api->RespondNotAuthorized();
    exit;
}

$controller = new $controllerClass($api);
$controller->$action();
